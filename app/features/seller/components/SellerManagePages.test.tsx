/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, fireEvent, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SellerDashboardPage } from "./SellerManagePages";

const dashboardRefetch = vi.fn();
const reviewsRefetch = vi.fn();
const profileRefetch = vi.fn();
const settingsRefetch = vi.fn();

let dashboardQuery: any;
let reviewsQuery: any;
let shopListQuery: any;
let profileQuery: any;
let settingsQuery: any;
let updateSettingsMutation: any;
let updateProfileMutation: any;

vi.mock("next/link", () => ({
  default: ({ href, children, prefetch: _prefetch, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

vi.mock("#/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: any) => <div>{children}</div>,
  AlertDialogAction: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  AlertDialogCancel: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  AlertDialogContent: ({ children }: any) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: any) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: any) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: any) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("#/components/ui/button", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock("#/components/ui/card", () => ({
  Card: ({ children, ...props }: any) => <section {...props}>{children}</section>,
  CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: any) => <h2 {...props}>{children}</h2>,
}));

vi.mock("#/components/ui/data-table", () => ({
  DataTable: () => <div data-testid="mock-data-table" />,
}));

vi.mock("#/components/ui/dialog", () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <div>{children}</div>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("#/components/ui/input", () => ({ Input: (props: any) => <input {...props} /> }));
vi.mock("#/components/ui/label", () => ({ Label: ({ children, ...props }: any) => <label {...props}>{children}</label> }));
vi.mock("#/components/ui/select", () => ({
  Select: ({ children }: any) => <div>{children}</div>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children }: any) => <div>{children}</div>,
  SelectTrigger: ({ children }: any) => <button type="button">{children}</button>,
  SelectValue: ({ children }: any) => <span>{children}</span>,
}));
vi.mock("#/components/ui/table", () => ({
  Table: ({ children }: any) => <table>{children}</table>,
  TableBody: ({ children }: any) => <tbody>{children}</tbody>,
  TableCell: ({ children }: any) => <td>{children}</td>,
  TableHead: ({ children }: any) => <th>{children}</th>,
  TableHeader: ({ children }: any) => <thead>{children}</thead>,
  TableRow: ({ children }: any) => <tr>{children}</tr>,
}));
vi.mock("#/components/ui/textarea", () => ({ Textarea: (props: any) => <textarea {...props} /> }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("shopId=shop-1"),
}));

vi.mock("#/i18n/client", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("../hooks/useSellerManage", () => ({
  useSellerDashboard: () => dashboardQuery,
  useSellerDashboardReviews: () => reviewsQuery,
  useSellerShopList: () => shopListQuery,
  useSellerShopProfile: () => profileQuery,
  useSellerShopSettings: () => settingsQuery,
  useUpdateSellerShopSettings: () => updateSettingsMutation,
  useUpdateSellerShopProfile: () => updateProfileMutation,

  useApproveReturn: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateSellerCoupon: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateSellerProductImage: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateSellerPayout: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateSellerProduct: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateSellerVariant: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteSellerCoupon: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteSellerProductImage: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteSellerVariant: () => ({ mutate: vi.fn(), isPending: false }),
  useDeliverShipment: () => ({ mutate: vi.fn(), isPending: false }),
  usePackShipment: () => ({ mutate: vi.fn(), isPending: false }),
  useRejectReturn: () => ({ mutate: vi.fn(), isPending: false }),
  useSellerBrands: () => ({ data: [], isLoading: false, error: null, refetch: vi.fn() }),
  useSellerCategories: () => ({ data: [], isLoading: false, error: null, refetch: vi.fn() }),
  useSellerCoupons: () => ({ data: [], isLoading: false, error: null, refetch: vi.fn() }),
  useSellerPayouts: () => ({ data: [], isLoading: false, error: null, refetch: vi.fn() }),
  useSellerProducts: () => ({ data: { data: [] }, isLoading: false, error: null, refetch: vi.fn() }),
  useSellerReturns: () => ({ data: [], isLoading: false, error: null, refetch: vi.fn() }),
  useSellerShipments: () => ({ data: [], isLoading: false, error: null, refetch: vi.fn() }),
  useSellerTransactions: () => ({ data: { data: [] }, isLoading: false, error: null, refetch: vi.fn() }),
  useSellerWallet: () => ({ data: null, isLoading: false, error: null, refetch: vi.fn() }),
  useShipShipment: () => ({ mutate: vi.fn(), isPending: false }),
  useArchiveSellerProduct: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateSellerProduct: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateSellerCoupon: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateSellerInventory: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateSellerProductImage: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateSellerVariant: () => ({ mutate: vi.fn(), isPending: false }),
}));

describe("SellerDashboardPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    dashboardRefetch.mockReset();
    reviewsRefetch.mockReset();
    profileRefetch.mockReset();
    settingsRefetch.mockReset();

    dashboardQuery = {
      data: {
        sales: { todaySalesCents: 150000, thisMonthSalesCents: 4300000, totalSalesCents: 9000000 },
        orders: { pendingPack: 3, shipped: 5, delivered: 20, cancelled: 1 },
        products: { active: 12, inactive: 2, lowStock: 1 },
        shopInsights: { averageRating: 4.25, publishedReviewCount: 12, pendingReviewCount: 2 },
        lowStockItems: [
          {
            variantId: "variant-1",
            productId: "product-1",
            productTitle: "Cotton Tee",
            productSlug: "cotton-tee",
            variantTitle: "Black / M",
            sku: "TEE-BLK-M",
            quantityOnHand: 2,
            quantityReserved: 0,
            availableQuantity: 2,
            reorderLevel: 4,
          },
        ],
        recentOrders: [
          {
            orderId: "order-1",
            orderNo: "ORD-1",
            status: "PAID",
            paymentStatus: "SUCCEEDED",
            createdAt: new Date("2026-06-01T00:00:00.000Z"),
            totalCents: 2400,
            items: [
              {
                orderItemId: "item-1",
                productTitle: "Cotton Tee",
                productSlug: "cotton-tee",
                variantTitle: "Black / M",
                variantSku: "TEE-BLK-M",
                quantity: 2,
                lineTotal: 2400,
                fulfillmentStatus: "PENDING",
              },
            ],
          },
        ],
      },
      isLoading: false,
      error: null,
      refetch: dashboardRefetch,
    };

    reviewsQuery = {
      data: [
        {
          reviewId: "review-1",
          shopId: "shop-1",
          shopName: "Shop One",
          shopSlug: "shop-one",
          buyerId: "buyer-1",
          buyerName: "Buyer One",
          rating: 4,
          comment: "Great support",
          status: "REJECTED",
          createdAt: new Date("2026-06-01T00:00:00.000Z"),
          moderatedAt: new Date("2026-06-01T00:10:00.000Z"),
          moderationReason: "Needs clearer evidence",
        },
      ],
      isLoading: false,
      error: null,
      refetch: reviewsRefetch,
    };

    shopListQuery = {
      data: {
        shops: [{ id: "shop-1", name: "Shop One", slug: "shop-one", status: "ACTIVE" }],
        activeShopId: "shop-1",
        maxShopCount: 3,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    };

    profileQuery = {
      data: {
        id: "shop-1",
        name: "Shop One",
        slug: "shop-one",
        status: "ACTIVE",
        contactEmail: "seller@shop.one",
        contactPhone: "0800000000",
        description: null,
        descriptionTh: null,
        descriptionEn: null,
        logoUrl: null,
        coverUrl: null,
        metaTitle: null,
        metaDescription: null,
        updatedAt: new Date("2026-06-01T00:00:00.000Z"),
      },
      isLoading: false,
      error: null,
      refetch: profileRefetch,
    };

    settingsQuery = {
      data: {
        id: "setting-1",
        shopId: "shop-1",
        autoAcceptOrder: false,
        allowCod: false,
        chatEnabled: true,
        vacationMode: false,
        defaultShippingProvider: null,
        shippingFeeBaht: 35,
        returnPolicy: null,
        shippingPolicy: null,
        returnPolicyTh: null,
        returnPolicyEn: null,
        shippingPolicyTh: null,
        shippingPolicyEn: null,
        version: 1,
        updatedAt: new Date("2026-06-01T00:00:00.000Z"),
      },
      isLoading: false,
      error: null,
      refetch: settingsRefetch,
    };

    updateSettingsMutation = {
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockResolvedValue({}),
      isPending: false,
    };
    updateProfileMutation = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false };
  });

  it("renders dashboard insights with moderation-aware shop reviews", () => {
    render(<SellerDashboardPage />);

    expect(screen.getByText("seller.manage.shopInsightsTitle")).toBeTruthy();
    expect(screen.getByText("seller.manage.recentShopReviewsTitle")).toBeTruthy();
    expect(screen.getByText(/seller.manage.reviewModerationReason/)).toBeTruthy();
    expect(screen.getByText("seller.manage.staffDescription")).toBeTruthy();
  });

  it("submits localized shop content while preserving base fields", async () => {
    render(<SellerDashboardPage />);
    const description = screen.getAllByLabelText("seller.manage.baseDescription").at(-1)!;
    const form = description.closest("form")!;
    fireEvent.change(description, { target: { value: "Base copy" } });
    fireEvent.change(within(form).getByLabelText("seller.manage.thaiShippingPolicy"), { target: { value: "  " } });
    fireEvent.click(within(form).getByRole("button", { name: "seller.manage.saveLocalizedContent" }));
    expect(updateProfileMutation.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ shopId: "shop-1", description: "Base copy" }));
    expect(updateSettingsMutation.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ shopId: "shop-1", shippingPolicyTh: null }));
  });

  it("submits the shop shipping fee in baht", () => {
    render(<SellerDashboardPage />);

    const input = screen.getByLabelText("seller.manage.shippingFeeBaht");
    fireEvent.change(input, { target: { value: "89.50" } });
    fireEvent.submit(input.closest("form")!);

    expect(updateSettingsMutation.mutate).toHaveBeenCalledWith(
      { shopId: "shop-1", shippingFeeBaht: 89.5 },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
  });

  it("shows review error state and retries review fetch", () => {
    reviewsQuery = {
      ...reviewsQuery,
      data: undefined,
      error: new Error("load failed"),
      refetch: reviewsRefetch,
    };

    render(<SellerDashboardPage />);

    expect(screen.getByText("seller.manage.reviewsLoadError")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "seller.manage.retry" }));

    expect(reviewsRefetch).toHaveBeenCalled();
  });
});
