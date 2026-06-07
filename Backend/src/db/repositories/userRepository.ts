import { getDb } from "../database";

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  project_id: string;
  password_hash: string | null;
  created_at: string;
}

export const userRepository = {
  /** Check if a user with this email exists */
  findByEmail(email: string): UserRow | null {
    const stmt = getDb().prepare("SELECT * FROM users WHERE email = ?");
    return stmt.get(email) as UserRow | null;
  },

  /** Insert a new user */
  insert(user: {
    id: string;
    email: string;
    name: string;
    role: string;
    project_id: string;
    password_hash: string;
    created_at: string;
  }): void {
    const stmt = getDb().prepare(`
      INSERT INTO users (id, email, name, role, project_id, password_hash, created_at)
      VALUES ($id, $email, $name, $role, $project_id, $password_hash, $created_at)
    `);
    stmt.run({
      $id: user.id,
      $email: user.email,
      $name: user.name,
      $role: user.role,
      $project_id: user.project_id,
      $password_hash: user.password_hash,
      $created_at: user.created_at,
    });
  },
};
