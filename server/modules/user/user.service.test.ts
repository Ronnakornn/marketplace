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

vi.mock("better-auth/crypto", () => ({
  hashPassword: vi.fn(async (password: string) => `hashed:${password}`),
  verifyPassword: vi.fn(async ({ hash, password }: { hash: string; password: string }) => hash === `hashed:${password}`),
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
  emailVerified: boolean
}> = {}) {
  const now = new Date("2026-04-12T00:00:00.000Z")

  return {
    id: overrides.id ?? "user-1",
    name: overrides.name ?? "Test User",
    email: overrides.email ?? "user@example.com",
    role: overrides.role ?? "USER",
    status: overrides.status ?? "ACTIVE",
    emailVerified: overrides.emailVerified ?? false,
    phone: null,
    phoneVerified: false,
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
    findByPhone: vi.fn(),
    countAdmins: vi.fn(),
    updateUser: vi.fn(),
    updateCurrentUser: vi.fn(),
    markEmailVerified: vi.fn(),
    createVerification: vi.fn(),
    findVerification: vi.fn(),
    deleteVerificationsByIdentifier: vi.fn(),
    deleteVerification: vi.fn(),
    findCredentialAccount: vi.fn(),
    updateCredentialPassword: vi.fn(),
    delete: vi.fn(),
    promoteByEmails: vi.fn(),
    listAddresses: vi.fn(),
    findAddress: vi.fn(),
    createAddress: vi.fn(),
    updateAddress: vi.fn(),
    deleteAddress: vi.fn(),
    setDefaultAddress: vi.fn(),
    listFavoriteProducts: vi.fn(),
    findFavoriteProduct: vi.fn(),
    addFavoriteProduct: vi.fn(),
    removeFavoriteProduct: vi.fn(),
    listFollowedShops: vi.fn(),
    findShopFollow: vi.fn(),
    findShopOwner: vi.fn(),
    followShop: vi.fn(),
    unfollowShop: vi.fn(),
  }
}

describe("UserService", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("prevents a shop owner from following their own shop", async () => {
    const repo = createRepoMock()
    vi.mocked(repo.findShopOwner).mockResolvedValue({ ownerId: "owner-1" })
    const service = new UserService(createAppContext(), repo)
    await expect(service.followShop("owner-1", "shop-1")).rejects.toMatchObject({ message: "Shop owners cannot follow their own shop", status: 403 })
    expect(repo.followShop).not.toHaveBeenCalled()
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

  it("normalizes phone updates and resets phone verification", async () => {
    const repo = createRepoMock()
    const updatedUser = createUser({ id: "user-1" })
    vi.mocked(repo.findByPhone).mockResolvedValue(null)
    vi.mocked(repo.updateCurrentUser).mockResolvedValue({ ...updatedUser, phone: "+66812345678", phoneVerified: false })

    const service = new UserService(createAppContext(), repo)

    await expect(service.updateCurrentUser("user-1", { phone: " +66 81 234 5678 " })).resolves.toMatchObject({
      phone: "+66812345678",
      phoneVerified: false,
    })

    expect(repo.updateCurrentUser).toHaveBeenCalledWith("user-1", {
      phone: "+66812345678",
      phoneVerified: false,
    })
  })

  it("rejects duplicate phone updates", async () => {
    const repo = createRepoMock()
    vi.mocked(repo.findByPhone).mockResolvedValue(createUser({ id: "user-2" }))

    const service = new UserService(createAppContext(), repo)

    await expect(service.updateCurrentUser("user-1", { phone: "0812345678" })).rejects.toMatchObject({
      message: "Phone is already in use",
      status: 409,
    })
  })

  it("keeps OTP purposes separated", async () => {
    const repo = createRepoMock()
    vi.mocked(repo.findByEmail).mockResolvedValue(createUser({ email: "user@example.com" }))
    vi.mocked(repo.findVerification).mockResolvedValue(null)

    const service = new UserService(createAppContext(), repo)

    await expect(service.verifyEmailOtp("USER@example.com", "123456")).rejects.toMatchObject({
      status: 400,
    })

    expect(repo.findVerification).toHaveBeenCalledWith(
      "EMAIL_VERIFICATION:user@example.com",
      expect.stringMatching(/^[a-f0-9]{64}$/),
    )
  })

  it("rejects expired OTPs", async () => {
    const repo = createRepoMock()
    vi.mocked(repo.findByEmail).mockResolvedValue(createUser({ email: "user@example.com" }))
    vi.mocked(repo.findVerification).mockResolvedValue({
      id: "verification-1",
      identifier: "EMAIL_VERIFICATION:user@example.com",
      value: "123456",
      expiresAt: new Date("2020-01-01T00:00:00.000Z"),
      createdAt: new Date("2020-01-01T00:00:00.000Z"),
      updatedAt: new Date("2020-01-01T00:00:00.000Z"),
    })

    const service = new UserService(createAppContext(), repo)

    await expect(service.verifyEmailOtp("user@example.com", "123456")).rejects.toMatchObject({
      message: "Invalid or expired verification code",
      status: 400,
    })
  })

  it("verifies email and consumes the OTP", async () => {
    const repo = createRepoMock()
    vi.mocked(repo.findByEmail).mockResolvedValue(createUser({ id: "user-1", email: "user@example.com" }))
    vi.mocked(repo.findVerification).mockResolvedValue({
      id: "verification-1",
      identifier: "EMAIL_VERIFICATION:user@example.com",
      value: "123456",
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(repo.markEmailVerified).mockResolvedValue(createUser({ emailVerified: true }))
    vi.mocked(repo.deleteVerification).mockResolvedValue()

    const service = new UserService(createAppContext(), repo)

    await expect(service.verifyEmailOtp("user@example.com", "123456")).resolves.toEqual({ success: true })
    expect(repo.markEmailVerified).toHaveBeenCalledWith("user-1")
    expect(repo.deleteVerification).toHaveBeenCalledWith("verification-1")
  })

  it("does not reveal whether a password reset email exists", async () => {
    const repo = createRepoMock()
    vi.mocked(repo.findByEmail).mockResolvedValue(null)

    const service = new UserService(createAppContext(), repo)

    await expect(service.requestPasswordResetOtp("missing@example.com")).resolves.toEqual({ success: true })
    expect(repo.createVerification).not.toHaveBeenCalled()
  })

  it("resets password with a valid purpose-scoped OTP and consumes it", async () => {
    const repo = createRepoMock()
    vi.mocked(repo.findByEmail).mockResolvedValue(createUser({ id: "user-1", email: "user@example.com" }))
    vi.mocked(repo.findVerification).mockResolvedValue({
      id: "verification-1",
      identifier: "PASSWORD_RESET:user@example.com",
      value: "123456",
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(repo.findCredentialAccount).mockResolvedValue({
      id: "account-1",
      userId: "user-1",
      providerId: "credential",
      accountId: "user-1",
      password: "hashed:old-password",
      accessToken: null,
      refreshToken: null,
      idToken: null,
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
      scope: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(repo.updateCredentialPassword).mockResolvedValue({} as any)
    vi.mocked(repo.deleteVerification).mockResolvedValue()

    const service = new UserService(createAppContext(), repo)

    await expect(service.completePasswordReset("user@example.com", "123456", "new-password")).resolves.toEqual({ success: true })
    expect(repo.findVerification).toHaveBeenCalledWith(
      "PASSWORD_RESET:user@example.com",
      expect.stringMatching(/^[a-f0-9]{64}$/),
    )
    expect(repo.updateCredentialPassword).toHaveBeenCalledWith("account-1", "hashed:new-password")
    expect(repo.deleteVerification).toHaveBeenCalledWith("verification-1")
  })

  it("requires the current password when changing password", async () => {
    const repo = createRepoMock()
    vi.mocked(repo.findById).mockResolvedValue(createUser({ id: "user-1", emailVerified: true }))
    vi.mocked(repo.findCredentialAccount).mockResolvedValue({
      id: "account-1",
      userId: "user-1",
      providerId: "credential",
      accountId: "user-1",
      password: "hashed:old-password",
      accessToken: null,
      refreshToken: null,
      idToken: null,
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
      scope: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const service = new UserService(createAppContext(), repo)

    await expect(service.changePassword("user-1", "wrong-password", "new-password")).rejects.toMatchObject({
      message: "Current password is invalid",
      status: 400,
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
