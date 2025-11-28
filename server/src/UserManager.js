export class UserManager {
  constructor() {
    this.users = new Map();
  }

  addUser(userId, userData) {
    this.users.set(userId, {
      ...userData,
      joinedAt: Date.now()
    });
  }

  removeUser(userId) {
    this.users.delete(userId);
  }

  getUser(userId) {
    return this.users.get(userId);
  }

  getAllUsers() {
    return Array.from(this.users.values());
  }

  updateCursor(userId, position) {
    const user = this.users.get(userId);
    if (user) {
      user.cursor = position;
    }
  }
}