import { beforeEach, describe, expect, it, vi } from "vitest"
import { UserService } from "./user.service.ts"
import type { IUserRepository } from "./user.repository.ts"
import type { Role, UserStatus } from "#generated/client/enums.ts"

const { signUpEmailMock } = vi.hoisted(() => ({
  signUpEmailMock: vi.fn(),
}))

vi.mock("#server/lib/auth.ts", () => ({
  auth: {
    api: {
      signUpEmail: signUpEmailMock,
    },
  },
}))

vi.mock("better-auth/api", () => ({
  isAPIError: () => false,
}))

function createLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(),
  }
}

function createAppContext() {
  return {
    logger: createLogger(),
    config: { environment: "test" },
  }
}

function createUser(overrides: Partial<{
  id: string
  name: string
  email: string
  role: Role
  status: UserStatus
}> = {}) {
  const now = new Date("2026-04-12T00:00:00.000Z")

  return {
    id: overrides.id ?? "user-1",
    name: overrides.name ?? "Test User",
    email: overrides.email ?? "user@example.com",
    role: overrides.role ?? "USER",
    status: overrides.status ?? "ACTIVE",
    emailVerified: false,
    image: null,
    createdAt: now,
    updatedAt: now,
  }
}

function createRepoMock(): IUserRepository {
  return {
    findManyForAdmin: vi.fn(),
    findById: vi.fn(),
    findByEmail: vi.fn(),
    countAdmins: vi.fn(),
    updateUser: vi.fn(),
    updateCurrentUser: vi.fn(),
    delete: vi.fn(),
    promoteByEmails: vi.fn(),
  }
}

describe("UserService", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("prevents self-demotion for the current admin", async () => {
    const repo = createRepoMock()
    vi.mocked(repo.findById).mockResolvedValue(createUser({ id: "admin-1", role: "ADMIN" }))

    const service = new UserService(createAppContext(), repo)

    await expect(
      service.updateForAdmin("admin-1", "admin-1", {
        name: "Admin",
        email: "admin@example.com",
        role: "USER",
      }),
    ).rejects.toMatchObject({
      message: "You cannot remove your own admin access",
      status: 400,
    })
  })

  it("prevents demoting the last remaining admin", async () => {
    const repo = createRepoMock()
    vi.mocked(repo.findById).mockResolvedValue(createUser({ id: "admin-2", role: "ADMIN" }))
    vi.mocked(repo.findByEmail).mockResolvedValue(null)
    vi.mocked(repo.countAdmins).mockResolvedValue(0)

    const service = new UserService(createAppContext(), repo)

    await expect(
      service.updateForAdmin("admin-1", "admin-2", {
        name: "Admin Two",
        email: "admin2@example.com",
        role: "USER",
      }),
    ).rejects.toMatchObject({
      message: "At least one admin must remain",
      status: 400,
    })
  })

  it("rejects email changes that collide with another user", async () => {
    const repo = createRepoMock()
    vi.mocked(repo.findById).mockResolvedValue(createUser({ id: "user-2", role: "USER" }))
    vi.mocked(repo.findByEmail).mockResolvedValue(createUser({ id: "user-3", email: "taken@example.com" }))

    const service = new UserService(createAppContext(), repo)

    await expect(
      service.updateForAdmin("admin-1", "user-2", {
        name: "Changed",
        email: "taken@example.com",
        role: "USER",
      }),
    ).rejects.toMatchObject({
      message: "Email is already in use",
      status: 409,
    })
  })

  it("updates a user when the request is valid", async () => {
    const repo = createRepoMock()
    const updatedUser = createUser({
      id: "user-2",
      name: "Updated Name",
      email: "updated@example.com",
      role: "ADMIN",
    })
    vi.mocked(repo.findById).mockResolvedValue(createUser({ id: "user-2", role: "USER" }))
    vi.mocked(repo.findByEmail).mockResolvedValue(null)
    vi.mocked(repo.updateUser).mockResolvedValue(updatedUser)

    const service = new UserService(createAppContext(), repo)

    await expect(
      service.updateForAdmin("admin-1", "user-2", {
        name: " Updated Name ",
        email: "UPDATED@example.com ",
        role: "ADMIN",
      }),
    ).resolves.toMatchObject({
      id: "user-2",
      name: "Updated Name",
      email: "updated@example.com",
      role: "ADMIN",
    })

    expect(repo.updateUser).toHaveBeenCalledWith("user-2", {
      name: "Updated Name",
      email: "updated@example.com",
      role: "ADMIN",
    })
  })

  it("updates the current user profile", async () => {
    const repo = createRepoMock()
    const updatedUser = createUser({ id: "user-1", name: "Updated User" })
    vi.mocked(repo.updateCurrentUser).mockResolvedValue(updatedUser)

    const service = new UserService(createAppContext(), repo)

    await expect(
      service.updateCurrentUser("user-1", {
        name: " Updated User ",
      }),
    ).resolves.toMatchObject({
      id: "user-1",
      name: "Updated User",
      email: "user@example.com",
      role: "USER",
      status: "ACTIVE",
    })

    expect(repo.updateCurrentUser).toHaveBeenCalledWith("user-1", {
      name: "Updated User",
    })
  })

  it("prevents an admin from suspending their own account", async () => {
    const repo = createRepoMock()
    vi.mocked(repo.findById).mockResolvedValue(createUser({ id: "admin-1", role: "ADMIN" }))

    const service = new UserService(createAppContext(), repo)

    await expect(service.updateStatus("admin-1", "admin-1", "SUSPENDED")).rejects.toMatchObject({
      message: "You cannot suspend your own account",
      status: 400,
    })
  })

  it("prevents self-delete", async () => {
    const repo = createRepoMock()
    vi.mocked(repo.findById).mockResolvedValue(createUser({ id: "admin-1", role: "ADMIN" }))

    const service = new UserService(createAppContext(), repo)

    await expect(service.deleteForAdmin("admin-1", "admin-1")).rejects.toMatchObject({
      message: "You cannot delete your own account",
      status: 400,
    })
  })

  it("deletes another user when allowed", async () => {
    const repo = createRepoMock()
    vi.mocked(repo.findById).mockResolvedValue(createUser({ id: "user-9", role: "USER" }))
    vi.mocked(repo.delete).mockResolvedValue(createUser({ id: "user-9", role: "USER" }))

    const service = new UserService(createAppContext(), repo)

    await expect(service.deleteForAdmin("admin-1", "user-9")).resolves.toBeUndefined()
    expect(repo.delete).toHaveBeenCalledWith("user-9")
  })
})
