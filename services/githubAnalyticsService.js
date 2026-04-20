const GITHUB_REST_BASE = "https://api.github.com";
const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";
const USER_AGENT = "smart-home-api-lab/1.0";

const getGithubToken = () => {
  // eslint-disable-next-line no-restricted-syntax
  return process.env.GITHUB_TOKEN;
};

const getRestHeaders = () => {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": USER_AGENT,
    "X-GitHub-Api-Version": "2022-11-28",
  };

  const token = getGithubToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getRestHeaders(),
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const error = new Error(`GitHub request failed: ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }

  return await response.json();
};

const tryFetchJson = async (url, options = {}) => {
  try {
    return await fetchJson(url, options);
  } catch (error) {
    if (error.statusCode === 403 || error.statusCode === 429) {
      return null;
    }
    throw error;
  }
};

const chunk = (arr, size) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size)
    chunks.push(arr.slice(i, i + size));
  return chunks;
};

const runWithConcurrency = async (items, worker, limit = 6) => {
  const results = [];
  let index = 0;

  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (index < items.length) {
        const current = items[index++];
        results.push(await worker(current));
      }
    },
  );

  await Promise.all(runners);
  return results;
};

const listContributorsRest = async ({ owner, name, maxContributors = 400 }) => {
  const contributors = [];

  for (let page = 1; contributors.length < maxContributors; page++) {
    const rows = await tryFetchJson(
      `${GITHUB_REST_BASE}/repos/${owner}/${name}/contributors?per_page=100&page=${page}`,
    );

    if (!rows) break;

    if (!rows.length) break;

    for (const row of rows) {
      if (contributors.length >= maxContributors) break;
      if (row.login) contributors.push(row.login);
    }

    if (rows.length < 100) break;
  }

  return contributors;
};

const listUserReposRest = async (login) =>
  await fetchJson(
    `${GITHUB_REST_BASE}/users/${login}/repos?per_page=100&sort=updated&type=owner`,
  );

const rankRepositories = ({
  sourceFullName,
  contributors,
  reposByContributor,
}) => {
  const score = new Map();

  for (let i = 0; i < contributors.length; i++) {
    const login = contributors[i];
    const repos = reposByContributor[login] ?? [];

    for (const repo of repos) {
      if (
        !repo?.full_name ||
        repo.full_name.toLowerCase() === sourceFullName.toLowerCase()
      ) {
        continue;
      }

      const existing = score.get(repo.full_name) ?? {
        repo: repo.full_name,
        url: repo.html_url,
        sharedContributors: 0,
      };

      existing.sharedContributors += 1;
      score.set(repo.full_name, existing);
    }
  }

  return Array.from(score.values())
    .sort((a, b) => b.sharedContributors - a.sharedContributors)
    .slice(0, 5);
};

export const getSharedReposV1Analytics = async ({ owner, name }) => {
  const repoMeta = await tryFetchJson(
    `${GITHUB_REST_BASE}/repos/${owner}/${name}`,
  );

  if (!repoMeta) {
    return {
      sourceRepo: `${owner}/${name}`,
      strategy: "v1-rest-only",
      contributorsAnalyzed: 0,
      degraded: true,
      reason: "GitHub API rate limit reached or temporarily unavailable",
      results: [],
    };
  }

  const contributors = await listContributorsRest({
    owner,
    name,
    maxContributors: 400,
  });
  const reposByContributor = {};

  await runWithConcurrency(
    contributors,
    async (login) => {
      try {
        reposByContributor[login] = await listUserReposRest(login);
      } catch {
        reposByContributor[login] = [];
      }
      return null;
    },
    6,
  );

  return {
    sourceRepo: `${owner}/${name}`,
    strategy: "v1-rest-only",
    contributorsAnalyzed: contributors.length,
    degraded: false,
    results: rankRepositories({
      sourceFullName: `${owner}/${name}`,
      contributors,
      reposByContributor,
    }),
  };
};

const fetchGraphqlBatch = async (logins) => {
  const fields = logins
    .map(
      (login, i) =>
        `u${i}: user(login: "${login}") {\n  repositories(first: 30, ownerAffiliations: OWNER, orderBy: {field: UPDATED_AT, direction: DESC}) {\n    nodes {\n      nameWithOwner\n      url\n    }\n  }\n}`,
    )
    .join("\n");

  const body = JSON.stringify({
    query: `query {\n${fields}\n}`,
  });

  const response = await fetch(GITHUB_GRAPHQL_URL, {
    method: "POST",
    headers: {
      ...getRestHeaders(),
      "Content-Type": "application/json",
    },
    body,
  });

  if (!response.ok) {
    const error = new Error(`GitHub GraphQL failed: ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }

  const payload = await response.json();
  if (payload.errors?.length) {
    const error = new Error(
      payload.errors[0]?.message ?? "Unknown GraphQL error",
    );
    error.statusCode = 502;
    throw error;
  }

  return payload.data ?? {};
};

export const getSharedReposV2Analytics = async ({ owner, name }) => {
  const repoMeta = await tryFetchJson(
    `${GITHUB_REST_BASE}/repos/${owner}/${name}`,
  );

  if (!repoMeta) {
    return {
      sourceRepo: `${owner}/${name}`,
      strategy: "v2-graphql-with-rest-fallback",
      contributorsAnalyzed: 0,
      degraded: true,
      reason: "GitHub API rate limit reached or temporarily unavailable",
      results: [],
    };
  }

  const contributors = await listContributorsRest({
    owner,
    name,
    maxContributors: 400,
  });
  const reposByContributor = {};

  const batches = chunk(contributors, 10);
  for (const batch of batches) {
    try {
      const data = await fetchGraphqlBatch(batch);
      batch.forEach((login, index) => {
        const repos = data[`u${index}`]?.repositories?.nodes ?? [];
        reposByContributor[login] = repos.map((r) => ({
          full_name: r.nameWithOwner,
          html_url: r.url,
        }));
      });
    } catch {
      await runWithConcurrency(
        batch,
        async (login) => {
          try {
            reposByContributor[login] = await listUserReposRest(login);
          } catch {
            reposByContributor[login] = [];
          }
          return null;
        },
        4,
      );
    }
  }

  return {
    sourceRepo: `${owner}/${name}`,
    strategy: "v2-graphql-with-rest-fallback",
    contributorsAnalyzed: contributors.length,
    degraded: false,
    results: rankRepositories({
      sourceFullName: `${owner}/${name}`,
      contributors,
      reposByContributor,
    }),
  };
};
