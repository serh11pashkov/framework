export const registerSchema = {
  type: "object",
  required: ["email", "password", "passwordConfirm"],
  properties: {
    email: {
      type: "string",
      format: "email",
      minLength: 3,
      maxLength: 255,
    },
    password: {
      type: "string",
      minLength: 8,
      maxLength: 255,
      description: "Password must be at least 8 characters long",
    },
    passwordConfirm: {
      type: "string",
      minLength: 8,
      maxLength: 255,
    },
  },
};

export const loginSchema = {
  type: "object",
  required: ["email", "password"],
  properties: {
    email: {
      type: "string",
      format: "email",
      minLength: 3,
      maxLength: 255,
    },
    password: {
      type: "string",
      minLength: 1,
      maxLength: 255,
    },
  },
};
