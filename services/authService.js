import argon2 from "argon2";
import { eq } from "drizzle-orm";
import { users } from "../db/schema.js";

export const createAuthService = ({ db } = {}) => {
  return {
    async register(email, password) {
      // Check if email already exists
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingUser.length > 0) {
        throw new Error("Email already registered");
      }

      // Hash password
      const hashedPassword = await argon2.hash(password);

      // Insert user
      const result = await db.insert(users).values({
        email,
        password: hashedPassword,
      });

      return {
        id: result.insertId || 1,
        email,
      };
    },

    async login(email, password) {
      // Find user
      const userList = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (userList.length === 0) {
        throw new Error("Invalid credentials");
      }

      const user = userList[0];

      // Verify password
      const isValid = await argon2.verify(user.password, password);
      if (!isValid) {
        throw new Error("Invalid credentials");
      }

      // Return user without password
      // eslint-disable-next-line no-unused-vars
      const { password: _, ...userWithoutPassword } = user;
      return userWithoutPassword;
    },

    async getUserById(id) {
      const userList = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (userList.length === 0) {
        return null;
      }

      const user = userList[0];
      // Return without password
      // eslint-disable-next-line no-unused-vars
      const { password: _, ...userWithoutPassword } = user;
      return userWithoutPassword;
    },
  };
};
