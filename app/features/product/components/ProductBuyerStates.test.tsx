/**
 * @vitest-environment jsdom
 */
import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DealsPage } from "#/features/buyer/components/DealsPage";
import { ProductDetailPage } from "./ProductDetailPage";
import { ProductListingPage } from "./ProductListingPage";

const queryMocks = vi.hoisted(() => ({
  productsResponse: { items: [] } as { items: unknown[]; meta?: Record<string, unknown>; facets?: Record<string, unknown> },
  productsResponsesByPage: new Map<number, { items: unknown[]; meta?: Record<string, unknown>; facets?: Record<string, unknown> }>(),
  productDetailResponse: null as unknown,
  productsError: null as unknown,
  productsErrorPages: new Set<number>(),
  productDetailError: null as unknown,
  productsQueryFn: vi.fn(),
  dealsResponse: { flashSale: null } as { flashSale: null | { id: string; title: string; description: string | null; endsAt: string | null; items: unknown[] } },
  dealsError: null as unknown,
  dealsQueryFn: vi.fn(),
  productDetailQueryFn: vi.fn(),
  relatedResponse: { items: [] } as { items: unknown[] },
  relatedError: null as unknown,
  relatedQueryFn: vi.fn(),
  recentlyViewedResponse: [] as unknown[],
  recentlyViewedError: null as unknown,
  recentlyViewedQueryFn: vi.fn(),
  reviewsResponse: { items: [], meta: { page: 1, limit: 5, totalCount: 0, hasNextPage: false } } as { items: unknown[]; meta: Record<string, unknown> },
  reviewsResponsesByPage: new Map<number, { items: unknown[]; meta: Record<string, unknown> }>(),
  questionsResponse: { items: [], meta: { page: 1, limit: 5, totalCount: 0, hasNextPage: false } } as { items: unknown[]; meta: Record<string, unknown> },
  questionsResponsesByPage: new Map<number, { items: unknown[]; meta: Record<string, unknown> }>(),
  ratingSummaryResponse: { averageRating: 0, totalReviewCount: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } } as unknown,
  reviewsError: null as unknown,
  questionsError: null as unknown,
  ratingSummaryError: null as unknown,
  reviewsQueryFn: vi.fn(),
  questionsQueryFn: vi.fn(),
  ratingSummaryQueryFn: vi.fn(),
  createProductQuestion: vi.fn(async () => ({ id: "question-new" })),
  couponsQueryFn: vi.fn(async () => []),
  addCartItem: vi.fn(async () => ({})),
  fetchCart: vi.fn(async (): Promise<{ shops: Array<{ items: Array<{ quantity: number }> }> }> => ({ shops: [] })),
  showAddToCartSuccess: vi.fn(),
  showAddToCartError: vi.fn(),
  routerPush: vi.fn(),
  session: { user: { role: "USER" } } as { user: { role: string } } | null,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, prefetch: _prefetch, ...props }: { href: string; children: ReactNode; prefetch?: boolean }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt, fill: _fill, priority: _priority, ...props }: { src: string; alt: string; fill?: boolean; priority?: boolean }) => <img src={src} alt={alt} {...props} />,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: queryMocks.routerPush }),
}));

vi.mock("#/components/BuyerShell", () => ({
  BuyerTopBar: ({ title }: { title: string }) => <header>{title}</header>,
  MobileBottomNavigation: () => <nav />,
}));

vi.mock("#/components/ui/badge", () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock("#/components/ui/button", () => ({
  Button: ({ children, asChild, ...props }: { children: ReactNode; asChild?: boolean }) => (
    asChild ? <>{children}</> : <button {...props}>{children}</button>
  ),
}));

vi.mock("#/components/ui/input", () => ({
  Input: (props: Record<string, unknown>) => <input {...props} />,
}));

vi.mock("#/components/ui/progress", () => ({
  Progress: () => <div role="progressbar" />,
}));

vi.mock("#/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  SheetHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  SheetTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("#/components/ui/skeleton", () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}));

vi.mock("#/features/buyer/api", () => ({
  addCartItem: queryMocks.addCartItem,
  addFavoriteProduct: vi.fn(async () => ({})),
  fetchCart: queryMocks.fetchCart,
  fetchFavoriteStatus: vi.fn(async () => false),
  fetchShopFollowStatus: vi.fn(async () => false),
  followShop: vi.fn(async () => ({})),
  fetchCoupons: queryMocks.couponsQueryFn,
  formatMoney: (cents: number, currency = "THB") => `${currency} ${(cents / 100).toFixed(2)}`,
  removeFavoriteProduct: vi.fn(async () => ({})),
  unfollowShop: vi.fn(async () => ({})),
}));

vi.mock("#/features/chat", () => ({
  createChatRoom: vi.fn(async () => ({ roomId: "room-1" })),
}));

vi.mock("#/features/product/cart-handoff", () => ({
  showAddToCartError: queryMocks.showAddToCartError,
  showAddToCartSuccess: queryMocks.showAddToCartSuccess,
}));

vi.mock("#/features/marketplace/queries", () => ({
  marketplaceHomeQueryOptions: () => ({
    queryKey: ["marketplace", "home", { locale: "en", limit: 24 }],
    queryFn: queryMocks.dealsQueryFn,
  }),
  normalizeMarketplaceHome: (value: unknown) => value,
}));

vi.mock("#/features/product/components/ProductCard", () => ({
  ProductCard: ({ product }: { product: { title: string } }) => <article>{product.title}</article>,
}));

vi.mock("#/features/product/queries", () => ({
  publicProductListQueryOptions: (input: { page?: number } = {}) => ({
    queryKey: ["product", "public", "lists", { locale: "en", limit: 40, page: input.page ?? 1 }],
    queryFn: () => queryMocks.productsQueryFn(input.page ?? 1),
  }),
  publicProductDetailQueryOptions: () => ({
    queryKey: ["product", "public", "details", { locale: "en", productId: "product-1" }],
    queryFn: queryMocks.productDetailQueryFn,
  }),
  publicRelatedProductsQueryOptions: () => ({
    queryKey: ["product", "public", "related", { locale: "en", productId: "product-1", limit: 8 }],
    queryFn: queryMocks.relatedQueryFn,
  }),
  publicProductReviewsQueryOptions: (input: { productId?: string; page?: number; rating?: number; hasMedia?: boolean; hasComment?: boolean; sort?: string } | string = "product-1") => {
    const normalized = typeof input === "string" ? { productId: input, page: 1 } : input;
    return {
      queryKey: ["product", "public", "reviews", normalized],
      queryFn: () => queryMocks.reviewsQueryFn(normalized),
    };
  },
  publicProductRatingSummaryQueryOptions: () => ({
    queryKey: ["product", "public", "rating-summary", "product-1"],
    queryFn: queryMocks.ratingSummaryQueryFn,
  }),
  publicProductQuestionsQueryOptions: (input: { productId?: string; page?: number; answerStatus?: string; sort?: string } | string = "product-1") => {
    const normalized = typeof input === "string" ? { productId: input, page: 1 } : input;
    return {
      queryKey: ["product", "public", "questions", normalized],
      queryFn: () => queryMocks.questionsQueryFn(normalized),
    };
  },
  publicProductSearchQueryOptions: (input: { page?: number } = {}) => ({
    queryKey: ["product", "public", "searches", { locale: "en", limit: 40, page: input.page ?? 1 }],
    queryFn: () => queryMocks.productsQueryFn(input.page ?? 1),
  }),
  publicSearchSuggestionsQueryOptions: () => ({
    queryKey: ["product", "public", "suggestions", { locale: "en", limit: 8 }],
    queryFn: async () => ({ items: [] }),
  }),
  publicCategoriesQueryOptions: () => ({
    queryKey: ["product", "public", "categories", { locale: "en" }],
    queryFn: async () => ({ items: [] }),
  }),
  publicBrandsQueryOptions: () => ({
    queryKey: ["product", "public", "brands"],
    queryFn: async () => [],
  }),
  normalizePublicProducts: (response: { items?: unknown[] }) => response.items ?? [],
  normalizePublicProductListing: (response: { items?: unknown[]; meta?: Record<string, unknown>; facets?: Record<string, unknown> }) => {
    const facets = response.facets ?? {};
    const price = facets.price && typeof facets.price === "object" ? facets.price as Record<string, unknown> : {};
    return {
      products: response.items ?? [],
      meta: {
        totalCount: typeof response.meta?.totalCount === "number" ? response.meta.totalCount : null,
        page: typeof response.meta?.page === "number" ? response.meta.page : 1,
        pageSize: typeof response.meta?.pageSize === "number" ? response.meta.pageSize : (response.items ?? []).length,
        hasNextPage: response.meta?.hasNextPage === true,
        query: {},
      },
      facets: {
        categories: Array.isArray(facets.categories) ? facets.categories : [],
        brands: Array.isArray(facets.brands) ? facets.brands : [],
        price: {
          min: typeof price.min === "number" ? price.min : null,
          max: typeof price.max === "number" ? price.max : null,
          currency: typeof price.currency === "string" ? price.currency : "THB",
        },
      },
    };
  },
  normalizePublicProduct: (response: unknown) => response,
  normalizePublicProductReviews: (response: { items?: unknown[] } | unknown[]) => Array.isArray(response) ? response : response.items ?? [],
  normalizePublicProductReviewsPage: (response: { items?: unknown[]; meta?: Record<string, unknown> } | unknown[]) => ({
    items: Array.isArray(response) ? response : response.items ?? [],
    meta: Array.isArray(response)
      ? { page: 1, limit: response.length || 5, totalCount: response.length, hasNextPage: false }
      : response.meta ?? { page: 1, limit: 5, totalCount: response.items?.length ?? 0, hasNextPage: false },
  }),
  normalizePublicProductRatingSummary: (response: unknown) => response,
  normalizePublicProductQuestions: (response: { items?: unknown[] } | unknown[]) => Array.isArray(response) ? response : response.items ?? [],
  normalizePublicProductQuestionsPage: (response: { items?: unknown[]; meta?: Record<string, unknown> } | unknown[]) => ({
    items: Array.isArray(response) ? response : response.items ?? [],
    meta: Array.isArray(response)
      ? { page: 1, limit: response.length || 5, totalCount: response.length, hasNextPage: false }
      : response.meta ?? { page: 1, limit: 5, totalCount: response.items?.length ?? 0, hasNextPage: false },
  }),
  createProductQuestion: queryMocks.createProductQuestion,
  productQueryKeys: {
    public: {
      questions: (productId: string) => ["product", "public", "questions", productId],
    },
  },
  normalizePublicCategories: () => [],
  normalizePublicBrands: () => [],
  normalizePublicSearchSuggestions: () => [],
}));

vi.mock("#/features/tracking", () => ({
  fetchRecentlyViewedProducts: queryMocks.recentlyViewedQueryFn,
  getLocalRecentlyViewedProducts: () => [],
  normalizeLocalRecentlyViewedProducts: (items: unknown[]) => items,
  saveLocalRecentlyViewedProduct: vi.fn(),
  trackDiscoveryEvent: vi.fn(),
  useDiscoveryTracking: () => ({
    trackRecentlyViewed: vi.fn(),
    trackProductClick: vi.fn(),
    queueProductImpression: vi.fn(),
  }),
  useTrackVisibleProducts: vi.fn(),
}));

vi.mock("#/lib/auth-client", () => ({
  useSession: () => ({ data: queryMocks.session }),
}));

vi.mock("#/lib/assets", () => ({
  resolveUploadedImageUrl: (url?: string) => url ?? "/placeholder.png",
}));

vi.mock("#/i18n/client", () => ({
  formatDate: () => "12:00",
  useLocale: () => "en",
  useTranslations: () => (key: string) => ({
    "buyer.dealFeed": "Deal feed",
    "buyer.dealFeedDescription": "Live deals from the catalog",
    "buyer.endsAt": "Ends at {time}",
    "buyer.endsSoon": "Ends soon",
    "buyer.filterMore": "Filter more",
    "buyer.flashSale": "Flash sale",
    "buyer.limitedDeals": "Limited deals",
    "buyer.noDealsAvailable": "No deals available",
    "buyer.noDealsDescription": "No deal products are available right now.",
    "buyer.sellingFast": "Selling fast",
    "buyer.vouchers": "Vouchers",
    "common.categories": "Categories",
    "common.deals": "Deals",
    "common.search": "Search",
    "product.category": "Category",
    "product.allCategories": "All categories",
    "product.applyFilters": "Apply filters",
    "product.clearFilters": "Clear filters",
    "product.discover": "Discover",
    "product.filterAndSort": "Filter and sort",
    "product.freeShipping": "Free shipping",
    "product.itemsFound": "{count} items found",
    "product.latest": "Latest",
    "product.loadingResults": "Loading results",
    "product.max": "Max",
    "product.min": "Min",
    "product.noProductsDescription": "No products match your filters.",
    "product.noProductsFound": "No products found",
    "product.noPurchasableVariant": "No purchasable variant",
    "product.products": "Products",
    "product.priceHigh": "Price high",
    "product.priceLow": "Price low",
    "product.priceRange": "Price range",
    "product.recommendedProducts": "Recommended products",
    "product.relevant": "Relevant",
    "product.shopTrustedStores": "Shop trusted stores",
    "product.specialDealsSoon": "Special deals soon",
    "product.soon": "Soon",
    "product.addToCart": "Add to cart",
    "product.adding": "Adding",
    "product.buyNow": "Buy now",
    "product.buyerProtection": "Buyer protection",
    "product.followShop": "Follow",
    "product.following": "Following",
    "product.inStock": "in stock",
    "product.noDescription": "No description",
    "product.noReviewsDescription": "No reviews yet.",
    "product.relatedProducts": "Related products",
    "product.reviews": "Reviews",
    "product.searchFilter": "Search filter",
    "product.searchResultsFor": "Search results for \"{query}\"",
    "product.shippingCalculated": "Shipping calculated at checkout",
    "product.sold": "sold",
    "product.topSales": "Top sales",
    "product.variants": "Variants",
    "product.wishlist": "Wishlist",
    "product.viewAll": "View all",
    "cart.continueShopping": "Continue shopping",
    "cart.handoffAddedDescription": "Your item was added to the cart.",
    "cart.handoffAddedTitle": "Added to cart",
    "cart.handoffErrorDescription": "Please try again or review the selected options.",
    "cart.handoffErrorTitle": "Could not add to cart",
    "cart.viewCart": "View cart",
    "common.add": "Add",
    "common.available": "Available",
    "common.details": "Details",
    "common.loading": "Loading...",
    "common.unavailable": "Unavailable",
    "home.recentlyViewedEmptyTitle": "No recently viewed products",
    "home.recentlyViewedTitle": "Recently viewed",
    "product.actionUnavailableTryAgain": "Add to cart is temporarily unavailable. Please try again.",
    "product.activeCount": "{count} active",
    "product.activeFilters": "Active filters",
    "product.activeFiltersCount": "{count} active filters",
    "product.activeMarketplaceShop": "Active marketplace shop",
    "product.addToWishlist": "Add to wishlist",
    "product.allBrands": "All brands",
    "product.allQuestions": "All questions",
    "product.allRatings": "All ratings",
    "product.allReviews": "All reviews",
    "product.answered": "Answered",
    "product.brand": "Brand",
    "product.brandFilter": "Brand: {value}",
    "product.buyerProtectionTitle": "Buyer protection",
    "product.categoryBeauty": "Beauty",
    "product.categoryElectronics": "Electronics",
    "product.categoryFashion": "Fashion",
    "product.categoryGroceries": "Groceries",
    "product.categoryHome": "Home",
    "product.chooseMoreOptions": "Choose {count} more options before purchasing.",
    "product.chooseOptionsBeforePurchase": "Choose product options before purchasing.",
    "product.condition": "Condition",
    "product.countryOfOrigin": "Country of origin",
    "product.decreaseQuantity": "Decrease quantity",
    "product.description": "Description",
    "product.descriptionSubtitle": "Product details from the seller.",
    "product.discoveryRailDescription": "Continue browsing similar or recently viewed items.",
    "product.factsCount": "{count} facts",
    "product.filterDescription": "Refine results without leaving this page.",
    "product.highlights": "Highlights",
    "product.highlightsDescription": "Quick seller-provided notes for this product.",
    "product.increaseQuantity": "Increase quantity",
    "product.itemsShown": "Showing {visible} of {total} items",
    "product.loadingMore": "Loading more...",
    "product.loadMore": "Load more",
    "product.loadMoreQuestions": "Load more questions",
    "product.loadMoreReviews": "Load more reviews",
    "product.loadingQuestions": "Loading questions",
    "product.loadingRail": "Loading {title}",
    "product.loadingRatingSummary": "Loading rating summary",
    "product.loadingReviews": "Loading reviews",
    "product.loginToAddToCart": "Log in to add this item to your cart.",
    "product.loginToAskQuestion": "Log in to ask a question",
    "product.marketplaceAssurances": "Marketplace assurances",
    "product.maximumStock": "Maximum {count}",
    "product.noHighlights": "No highlights provided.",
    "product.noProductFacts": "No product facts provided.",
    "product.noProductImageAvailable": "No product image available",
    "product.noProductImages": "{title} has no product images",
    "product.noPublishedReviewsDescription": "Published buyer reviews will appear here.",
    "product.noQuestionsDescription": "Buyer questions and seller answers will appear here.",
    "product.noQuestionsMatchFilters": "No questions match these filters",
    "product.noQuestionsTitle": "No questions yet",
    "product.noReviewsMatchFilters": "No reviews match these filters",
    "product.noReviewsTitle": "No reviews yet",
    "product.oldest": "Oldest",
    "product.onlyBuyerAccountsCanPurchase": "Only buyer accounts can purchase.",
    "product.onlyBuyerQuestions": "Only buyer accounts can ask product questions.",
    "product.optionCombinationUnavailable": "This option combination is unavailable.",
    "product.outOfStock": "Out of stock",
    "product.productFacts": "Product facts",
    "product.productFactsDescription": "Seller-provided facts and catalog attributes.",
    "product.productImage": "{title} image {index}",
    "product.productMediaGallery": "Product media gallery",
    "product.productUnavailable": "Product details are temporarily unavailable.",
    "product.productVideo": "{title} video",
    "product.quantity": "Quantity",
    "product.quantityShort": "Qty",
    "product.question": "Question",
    "product.questionAnswerFilter": "Question answer filter",
    "product.questionCount": "{count} questions",
    "product.questionCountOne": "{count} question",
    "product.questionPlaceholder": "Ask about sizing, warranty, packaging, or product details.",
    "product.questionSort": "Question sort",
    "product.questionSubmitted": "Question submitted.",
    "product.questionUnavailable": "Question submission is temporarily unavailable.",
    "product.questionsTitle": "Questions & answers",
    "product.questionsSubtitle": "Ask the seller about sizing, packaging, warranty, or product details.",
    "product.questionsUnavailable": "Questions are temporarily unavailable.",
    "product.railUnavailable": "{title} are temporarily unavailable.",
    "product.ratingHigh": "Rating high",
    "product.ratingLow": "Rating low",
    "product.ratingSummaryUnavailable": "Rating summary is temporarily unavailable.",
    "product.recentlyViewedEmptyDescription": "Products you viewed earlier will appear here.",
    "product.relatedEmptyDescription": "Similar products will appear here when available.",
    "product.relatedEmptyTitle": "No related products yet",
    "product.removeFilter": "Remove {label}",
    "product.removeFromWishlistShort": "Remove from wishlist",
    "product.returns": "Returns",
    "product.returnsPolicy": "Returns follow marketplace policy.",
    "product.reviewContentFilter": "Review content filter",
    "product.reviewCount": "{count} reviews",
    "product.reviewCountOne": "{count} review",
    "product.reviewImage": "Review image",
    "product.reviewMedia": "Review media",
    "product.reviewRatingFilter": "Review rating filter",
    "product.reviewSort": "Review sort",
    "product.reviewsSubtitle": "Published buyer feedback and rating summary.",
    "product.reviewsUnavailable": "Reviews are temporarily unavailable.",
    "product.retryLoadMore": "Retry load more",
    "product.selectVariant": "Select a variant",
    "product.selectVariantBeforePurchase": "Select a variant before purchasing.",
    "product.selectVariantForQuantity": "Select a variant to choose quantity",
    "product.selected": "Selected",
    "product.selectedQuantity": "{quantity} items",
    "product.selectedQuantityOne": "{quantity} item",
    "product.selectedVariant": "Selected variant",
    "product.selectedVariantOutOfStock": "Selected variant is out of stock.",
    "product.sellerAnswerFrom": "Seller answer from {name}",
    "product.sellerNotAnswered": "The seller has not answered yet.",
    "product.shopTrust": "Shop trust",
    "product.shipping": "Shipping",
    "product.soldBy": "Sold by",
    "product.showProductImage": "Show product image {index}",
    "product.showProductVideo": "Show product video",
    "product.shownCount": "{count} shown",
    "product.sortBy": "Sort by",
    "product.sortFilter": "Sort: {value}",
    "product.starCount": "{count} star",
    "product.starReview": "{rating} star review",
    "product.submitQuestion": "Submit question",
    "product.submittingQuestion": "Submitting...",
    "product.tryAnotherQuestionFilter": "Try another answer status filter.",
    "product.tryDifferentReviewFilter": "Try a different rating, media, or comment filter.",
    "product.unanswered": "Unanswered",
    "product.warranty": "Warranty",
    "product.withComment": "With comment",
    "product.withMedia": "With media",
    "product.yourQuestion": "Your question",
    "chat.chatSeller": "Chat seller",
    "chat.sellerInbox": "Seller inbox",
    "state.loadErrorTitle": "Unable to load products",
    "state.loadErrorDescription": "Products are temporarily unavailable.",
    "state.retry": "Retry",
  })[key] ?? key,
}));

vi.mock("#/i18n/navigation", () => ({
  useLocalePath: () => (path: string) => `/en${path}`,
}));

function renderWithClient(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  cleanup();
  queryMocks.productsResponse = { items: [] };
  queryMocks.productsResponsesByPage.clear();
  queryMocks.productDetailResponse = createProductDetailFixture();
  queryMocks.productsError = null;
  queryMocks.dealsResponse = { flashSale: null };
  queryMocks.dealsError = null;
  queryMocks.productsErrorPages.clear();
  queryMocks.productDetailError = null;
  queryMocks.relatedResponse = { items: [] };
  queryMocks.relatedError = null;
  queryMocks.recentlyViewedResponse = [];
  queryMocks.recentlyViewedError = null;
  queryMocks.reviewsResponse = { items: [], meta: { page: 1, limit: 5, totalCount: 0, hasNextPage: false } };
  queryMocks.reviewsResponsesByPage.clear();
  queryMocks.questionsResponse = { items: [], meta: { page: 1, limit: 5, totalCount: 0, hasNextPage: false } };
  queryMocks.questionsResponsesByPage.clear();
  queryMocks.ratingSummaryResponse = { averageRating: 0, totalReviewCount: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
  queryMocks.reviewsError = null;
  queryMocks.questionsError = null;
  queryMocks.ratingSummaryError = null;
  queryMocks.session = { user: { role: "USER" } };
  queryMocks.addCartItem.mockClear();
  queryMocks.fetchCart.mockClear();
  queryMocks.fetchCart.mockResolvedValue({ shops: [] });
  queryMocks.showAddToCartError.mockClear();
  queryMocks.showAddToCartSuccess.mockClear();
  queryMocks.createProductQuestion.mockClear();
  queryMocks.routerPush.mockClear();
  queryMocks.productsQueryFn.mockImplementation(async (page = 1) => {
    if (queryMocks.productsErrorPages.has(page)) throw new Error(`page ${page} unavailable`);
    if (queryMocks.productsError) throw queryMocks.productsError;
    return queryMocks.productsResponsesByPage.get(page) ?? queryMocks.productsResponse;
  });
  queryMocks.dealsQueryFn.mockImplementation(async () => {
    if (queryMocks.dealsError) throw queryMocks.dealsError;
    return queryMocks.dealsResponse;
  });
  queryMocks.productDetailQueryFn.mockImplementation(async () => {
    if (queryMocks.productDetailError) throw queryMocks.productDetailError;
    return queryMocks.productDetailResponse;
  });
  queryMocks.relatedQueryFn.mockImplementation(async () => {
    if (queryMocks.relatedError) throw queryMocks.relatedError;
    return queryMocks.relatedResponse;
  });
  queryMocks.recentlyViewedQueryFn.mockImplementation(async () => {
    if (queryMocks.recentlyViewedError) throw queryMocks.recentlyViewedError;
    return queryMocks.recentlyViewedResponse;
  });
  queryMocks.reviewsQueryFn.mockImplementation(async (input: { page?: number } = {}) => {
    if (queryMocks.reviewsError) throw queryMocks.reviewsError;
    return queryMocks.reviewsResponsesByPage.get(input.page ?? 1) ?? queryMocks.reviewsResponse;
  });
  queryMocks.questionsQueryFn.mockImplementation(async (input: { page?: number } = {}) => {
    if (queryMocks.questionsError) throw queryMocks.questionsError;
    return queryMocks.questionsResponsesByPage.get(input.page ?? 1) ?? queryMocks.questionsResponse;
  });
  queryMocks.ratingSummaryQueryFn.mockImplementation(async () => {
    if (queryMocks.ratingSummaryError) throw queryMocks.ratingSummaryError;
    return queryMocks.ratingSummaryResponse;
  });
  queryMocks.couponsQueryFn.mockResolvedValue([]);
});

describe("ProductListingPage buyer states", () => {
  it("shows an empty state instead of fallback products", async () => {
    renderWithClient(<ProductListingPage mode="home" />);

    expect(await screen.findByText("No products found")).toBeTruthy();
    expect(screen.getByText("No products match your filters.")).toBeTruthy();
    expect(screen.queryByText("Canvas Weekender Bag with laptop sleeve")).toBeNull();
  });

  it("shows an error state with retry when product loading fails", async () => {
    queryMocks.productsError = new Error("catalog unavailable");

    renderWithClient(<ProductListingPage mode="home" />);

    expect(await screen.findByText("Unable to load products")).toBeTruthy();
    expect(screen.getByText("catalog unavailable")).toBeTruthy();

    queryMocks.productsError = null;
    queryMocks.productsResponse = {
      items: [{ id: "product-1", title: "Recovered API product" }],
    };
    fireEvent.click(screen.getByRole("button", { name: /Retry/ }));

    await waitFor(() => expect(screen.getByText("Recovered API product")).toBeTruthy());
  });

  it("renders a readable listing error when API errors contain object payloads", async () => {
    queryMocks.productsError = { message: { code: "INVALID_FILTER" } };

    renderWithClient(<ProductListingPage mode="search" query="shirt" brandId="brand-does-not-exist" minPrice="999999" />);

    expect(await screen.findByText("Unable to load products")).toBeTruthy();
    expect(screen.getByText("Products are temporarily unavailable.")).toBeTruthy();
    expect(screen.queryByText("[object Object]")).toBeNull();
  });

  it("shows exact totals, appends load-more results, and dedupes product ids", async () => {
    queryMocks.productsResponsesByPage.set(1, {
      items: [
        createProductCardFixture({ id: "product-1", title: "First product" }),
        createProductCardFixture({ id: "product-2", title: "Second product" }),
      ],
      meta: { totalCount: 4, page: 1, pageSize: 2, hasNextPage: true },
    });
    queryMocks.productsResponsesByPage.set(2, {
      items: [
        createProductCardFixture({ id: "product-2", title: "Second product duplicate" }),
        createProductCardFixture({ id: "product-3", title: "Third product" }),
      ],
      meta: { totalCount: 4, page: 2, pageSize: 2, hasNextPage: false },
    });

    renderWithClient(<ProductListingPage mode="home" />);

    expect(await screen.findByText("First product")).toBeTruthy();
    expect(screen.getByText("Second product")).toBeTruthy();
    expect(screen.getByText("Showing 2 of 4 items")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Load more" }));

    expect(await screen.findByText("Third product")).toBeTruthy();
    expect(screen.queryByText("Second product duplicate")).toBeNull();
    expect(screen.getByText("Showing 3 of 4 items")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("keeps current products visible and retries when the next page fails", async () => {
    queryMocks.productsResponsesByPage.set(1, {
      items: [createProductCardFixture({ id: "product-1", title: "Stable product" })],
      meta: { totalCount: 2, page: 1, pageSize: 1, hasNextPage: true },
    });
    queryMocks.productsResponsesByPage.set(2, {
      items: [createProductCardFixture({ id: "product-2", title: "Recovered next product" })],
      meta: { totalCount: 2, page: 2, pageSize: 1, hasNextPage: false },
    });
    queryMocks.productsErrorPages.add(2);

    renderWithClient(<ProductListingPage mode="home" />);

    expect(await screen.findByText("Stable product")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));

    expect(await screen.findByText("page 2 unavailable")).toBeTruthy();
    expect(screen.getByText("Stable product")).toBeTruthy();
    expect(screen.queryByTestId("skeleton")).toBeNull();

    queryMocks.productsErrorPages.delete(2);
    fireEvent.click(screen.getByRole("button", { name: "Retry load more" }));

    expect(await screen.findByText("Recovered next product")).toBeTruthy();
    expect(screen.getByText("Stable product")).toBeTruthy();
  });

  it("renders metadata-driven category, brand, and price filters with unavailable facets disabled", async () => {
    queryMocks.productsResponse = {
      items: [createProductCardFixture({ id: "product-1", title: "Faceted listing product" })],
      meta: { totalCount: 1, page: 1, pageSize: 40, hasNextPage: false },
      facets: {
        categories: [
          { id: "cat-1", slug: "fashion", name: "Fashion", count: 3, active: false },
          { id: "cat-2", slug: "electronics", name: "Electronics", count: 0, active: false },
        ],
        brands: [
          { id: "brand-1", name: "Acme", slug: "acme", count: 2, active: false },
          { id: "brand-2", name: "Dormant", slug: "dormant", count: 0, active: false },
        ],
        price: { min: 100, max: 900, currency: "THB" },
      },
    };

    renderWithClient(<ProductListingPage mode="search" query="bag" />);

    expect(await screen.findByText("Faceted listing product")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /Fashion\s*3/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Acme\s*2/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("THB 100 - 900").length).toBeGreaterThan(0);
    expect(screen.getAllByPlaceholderText("100").length).toBeGreaterThan(0);
    expect(screen.getAllByPlaceholderText("900").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sort by").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Price low" }).length).toBeGreaterThan(0);

    const unavailableCategory = screen.getAllByText("Electronics")[0]?.closest("[aria-disabled='true']");
    const unavailableBrand = screen.getAllByText("Dormant")[0]?.closest("[aria-disabled='true']");
    expect(unavailableCategory).toBeTruthy();
    expect(unavailableBrand).toBeTruthy();
  });

  it("keeps active chips removable and clear filters preserving the search query", async () => {
    queryMocks.productsResponse = {
      items: [createProductCardFixture({ id: "product-1", title: "Filtered product" })],
      meta: { totalCount: 1, page: 1, pageSize: 40, hasNextPage: false },
      facets: {
        categories: [{ id: "cat-1", slug: "fashion", name: "Fashion", count: 1, active: true }],
        brands: [{ id: "brand-1", name: "Acme", slug: "acme", count: 1, active: true }],
        price: { min: 100, max: 900, currency: "THB" },
      },
    };

    renderWithClient(<ProductListingPage mode="search" query="bag" categoryId="fashion" brandId="brand-1" minPrice="100" maxPrice="900" />);

    expect(await screen.findByText("Filtered product")).toBeTruthy();
    const categoryChip = screen.getAllByRole("link", { name: /Fashion/ }).find((link) => !link.getAttribute("href")?.includes("categoryId=fashion"));
    const brandChip = screen.getAllByRole("link", { name: /Acme/ }).find((link) => !link.getAttribute("href")?.includes("brandId=brand-1"));
    const priceChip = screen.getAllByRole("link", { name: /100 - 900/ }).find((link) => !link.getAttribute("href")?.includes("minPrice=100"));
    expect(categoryChip?.getAttribute("href")).toContain("brandId=brand-1");
    expect(brandChip?.getAttribute("href")).toContain("categoryId=fashion");
    expect(priceChip?.getAttribute("href")).not.toContain("maxPrice=900");
    expect(screen.getAllByRole("link", { name: "Clear filters" })[0]?.getAttribute("href")).toBe("/search?q=bag");
  });

  it("keeps listing usable when products load without facet metadata", async () => {
    queryMocks.productsResponse = {
      items: [createProductCardFixture({ id: "product-1", title: "No facet product" })],
      meta: { totalCount: 1, page: 1, pageSize: 40, hasNextPage: false },
    };

    renderWithClient(<ProductListingPage mode="search" query="plain" />);

    expect(await screen.findByText("No facet product")).toBeTruthy();
    expect(screen.getAllByText("Search filter").length).toBeGreaterThan(0);
    expect(screen.queryByText("Specifications")).toBeNull();
    expect(screen.queryByText("Attribute filters")).toBeNull();
  });
});

describe("DealsPage buyer states", () => {
  it("shows an empty deal state instead of fallback products", async () => {
    renderWithClient(<DealsPage />);

    expect(await screen.findByText("No deals available")).toBeTruthy();
    expect(screen.getByText("No deal products are available right now.")).toBeTruthy();
    expect(screen.queryByText("Canvas Weekender Bag with laptop sleeve")).toBeNull();
  });

  it("shows an error state with retry for deal products", async () => {
    queryMocks.dealsError = new Error("deals unavailable");

    renderWithClient(<DealsPage />);

    expect(await screen.findByText("Unable to load products")).toBeTruthy();
    expect(screen.getByText("deals unavailable")).toBeTruthy();

    queryMocks.dealsError = null;
    const callsBeforeRetry = queryMocks.dealsQueryFn.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: /Retry/ }));

    await waitFor(() => expect(queryMocks.dealsQueryFn).toHaveBeenCalledTimes(callsBeforeRetry + 1));
  });
});

describe("ProductDetailPage buyer transaction states", () => {
  it("requires option selection before adding to cart and sends selected quantity", async () => {
    renderWithClient(<ProductDetailPage productId="product-1" />);

    const addToCart = await screen.findByRole("button", { name: /Add to cart/ });
    expect(addToCart).toHaveProperty("disabled", true);
    expect(addToCart.getAttribute("aria-describedby")).toContain("product-purchase-status");
    expect(screen.getAllByText("Choose product options before purchasing.").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Blue/ })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: /Green/ })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: /Blue/ })).toHaveProperty("title", "Out of stock");
    expect(screen.getByRole("button", { name: /Green/ })).toHaveProperty("title", "Unavailable");

    fireEvent.click(screen.getByRole("button", { name: "Red" }));
    fireEvent.click(screen.getByRole("button", { name: "M" }));

    await waitFor(() => expect(screen.getAllByText(/SKU RED-M/).length).toBeGreaterThan(0));
    expect(addToCart).toHaveProperty("disabled", false);

    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    fireEvent.click(addToCart);

    await waitFor(() => expect(queryMocks.addCartItem).toHaveBeenCalledWith("variant-red-m", 2));
  });

  it("uses stable pending labels on product detail purchase actions", async () => {
    let resolveAdd: (value: Record<string, never>) => void = () => {};
    queryMocks.addCartItem.mockImplementationOnce(() => new Promise((resolve) => {
      resolveAdd = resolve;
    }));

    renderWithClient(<ProductDetailPage productId="product-1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Red" }));
    fireEvent.click(screen.getByRole("button", { name: "M" }));
    fireEvent.click(screen.getByRole("button", { name: /Add to cart/ }));

    await waitFor(() => expect(screen.getAllByRole("button", { name: /Adding/ }).length).toBeGreaterThan(0));
    expect(screen.getAllByRole("button", { name: /Adding/ })[0]).toHaveProperty("disabled", true);

    resolveAdd({});
    await waitFor(() => expect(queryMocks.showAddToCartSuccess).toHaveBeenCalled());
  });

  it("shows add-to-cart confirmation and refreshes the buyer cart query after success", async () => {
    queryMocks.fetchCart
      .mockResolvedValueOnce({ shops: [] })
      .mockResolvedValueOnce({
        shops: [{
          items: [{ quantity: 2 }],
        }],
      });

    renderWithClient(<ProductDetailPage productId="product-1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Red" }));
    fireEvent.click(screen.getByRole("button", { name: "M" }));
    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    fireEvent.click(screen.getByRole("button", { name: /Add to cart/ }));

    await waitFor(() => expect(queryMocks.addCartItem).toHaveBeenCalledWith("variant-red-m", 2));
    await waitFor(() => expect(queryMocks.fetchCart).toHaveBeenCalledTimes(2));
    expect(queryMocks.showAddToCartSuccess).toHaveBeenCalledWith({
      copy: {
        continueShopping: "Continue shopping",
        successDescription: "Your item was added to the cart.",
        successTitle: "Added to cart",
        viewCart: "View cart",
      },
      context: {
        productTitle: "Variant Product",
        variantTitle: "Red / M",
      },
      onViewCart: expect.any(Function),
    });
    expect(queryMocks.showAddToCartError).not.toHaveBeenCalled();

    queryMocks.showAddToCartSuccess.mock.calls[0]?.[0]?.onViewCart?.();
    expect(queryMocks.routerPush).toHaveBeenCalledWith("/en/cart");
  });

  it("shows a readable add-to-cart error when the mutation fails", async () => {
    const apiError = { response: { error: "Selected stock is no longer available." } };
    queryMocks.addCartItem.mockRejectedValueOnce(apiError);

    renderWithClient(<ProductDetailPage productId="product-1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Red" }));
    fireEvent.click(screen.getByRole("button", { name: "M" }));
    fireEvent.click(screen.getByRole("button", { name: /Add to cart/ }));

    await waitFor(() => expect(queryMocks.showAddToCartError).toHaveBeenCalledWith({
      copy: {
        errorDescription: "Please try again or review the selected options.",
        errorTitle: "Could not add to cart",
      },
      error: apiError,
    }));
    expect((await screen.findAllByText("Selected stock is no longer available.")).length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText("[object Object]")).toBeNull();
    expect(queryMocks.showAddToCartSuccess).not.toHaveBeenCalled();
    expect(queryMocks.routerPush).not.toHaveBeenCalledWith("/en/cart");
  });

  it("shows sticky purchase context and keeps buy-now on the current cart flow", async () => {
    renderWithClient(<ProductDetailPage productId="product-1" />);

    await screen.findByRole("button", { name: /Add to cart/ });
    expect(screen.getAllByText("THB 12.00 - THB 15.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Select Color / Size").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Red" }));
    fireEvent.click(screen.getByRole("button", { name: "M" }));

    expect(await screen.findAllByText(/Red \/ M/)).toHaveLength(2);
    expect(screen.getAllByText("3 in stock").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /Buy now/ }));

    await waitFor(() => expect(queryMocks.addCartItem).toHaveBeenCalledWith("variant-red-m", 1));
    await waitFor(() => expect(queryMocks.showAddToCartSuccess).toHaveBeenCalledWith({
      copy: {
        continueShopping: "Continue shopping",
        successDescription: "Your item was added to the cart.",
        successTitle: "Added to cart",
        viewCart: "View cart",
      },
      context: {
        productTitle: "Variant Product",
        variantTitle: "Red / M",
      },
      onViewCart: expect.any(Function),
    }));
    await waitFor(() => expect(queryMocks.routerPush).toHaveBeenCalledWith("/en/cart"));
  });

  it("does not navigate buy-now when add-to-cart fails", async () => {
    const apiError = { response: { error: "Selected stock is no longer available." } };
    queryMocks.addCartItem.mockRejectedValueOnce(apiError);

    renderWithClient(<ProductDetailPage productId="product-1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Red" }));
    fireEvent.click(screen.getByRole("button", { name: "M" }));
    fireEvent.click(screen.getByRole("button", { name: /Buy now/ }));

    await waitFor(() => expect(queryMocks.showAddToCartError).toHaveBeenCalledWith({
      copy: {
        errorDescription: "Please try again or review the selected options.",
        errorTitle: "Could not add to cart",
      },
      error: apiError,
    }));
    expect(queryMocks.routerPush).not.toHaveBeenCalledWith("/en/cart");
    expect(queryMocks.showAddToCartSuccess).not.toHaveBeenCalled();
    expect(screen.queryByText("[object Object]")).toBeNull();
  });

  it("keeps sticky purchase actions described by visible purchase status", async () => {
    renderWithClient(<ProductDetailPage productId="product-1" />);

    const stickyBar = await screen.findByTestId("product-sticky-buy-bar");
    const addToCart = within(stickyBar).getByRole("button", { name: /Add to cart/ });
    const buyNow = within(stickyBar).getByRole("button", { name: /Buy now/ });

    expect(addToCart.getAttribute("aria-describedby")).toContain("product-purchase-status");
    expect(buyNow.getAttribute("aria-describedby")).toContain("product-purchase-status");
    expect(within(stickyBar).getAllByText("Choose product options before purchasing.").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Red" }));
    fireEvent.click(screen.getByRole("button", { name: "M" }));

    await waitFor(() => expect(within(stickyBar).getAllByText("1 item | 3 in stock").length).toBeGreaterThan(0));
    expect(within(stickyBar).getByText("Red / M | SKU RED-M | Qty 1")).toBeTruthy();
  });

  it("exposes gallery image and video controls as keyboard-accessible options", async () => {
    renderWithClient(<ProductDetailPage productId="product-1" />);

    const firstImage = await screen.findByRole("option", { name: "Show product image 1" });
    const secondImage = screen.getByRole("option", { name: "Show product image 2" });
    const videoControl = screen.getByRole("option", { name: "Show product video" });

    expect(firstImage.getAttribute("aria-selected")).toBe("true");
    expect(secondImage.getAttribute("aria-selected")).toBe("false");
    expect(videoControl.getAttribute("aria-selected")).toBe("false");

    secondImage.focus();
    expect(document.activeElement).toBe(secondImage);
    fireEvent.click(videoControl);

    expect(await screen.findByLabelText("Variant Product video")).toBeTruthy();
    expect(videoControl.getAttribute("aria-selected")).toBe("true");
  });

  it("renders a useful media fallback when a product has no images", async () => {
    queryMocks.productDetailResponse = {
      ...createProductDetailFixture(),
      images: [],
      video: null,
    };

    renderWithClient(<ProductDetailPage productId="product-1" />);

    expect(await screen.findByRole("img", { name: "Variant Product has no product images" })).toBeTruthy();
    expect(screen.getByText("No product image available")).toBeTruthy();
    expect(screen.queryByRole("listbox", { name: "Product media gallery" })).toBeNull();
  });

  it("renders trust, facts, and description sections as scannable buyer content", async () => {
    renderWithClient(<ProductDetailPage productId="product-1" />);

    expect(await screen.findByRole("img", { name: "Variant Product" })).toBeTruthy();
    expect(screen.getByLabelText("Marketplace assurances")).toBeTruthy();
    expect(screen.getByText("Shipping")).toBeTruthy();
    expect(screen.getByText("Shipping calculated at checkout")).toBeTruthy();
    expect(screen.getAllByText("Buyer protection").length).toBeGreaterThan(0);
    expect(screen.getByText("Returns")).toBeTruthy();
    expect(screen.getByLabelText("Shop trust")).toBeTruthy();
    expect(screen.getByText("Sold by")).toBeTruthy();
    expect(screen.getAllByText("Demo Shop").length).toBeGreaterThan(0);
    expect(screen.getByText("Active marketplace shop")).toBeTruthy();
    expect(screen.getByText("Seller-provided facts and catalog attributes.")).toBeTruthy();
    expect(screen.getByText("4 facts")).toBeTruthy();
    expect(screen.getByText("Condition")).toBeTruthy();
    expect(screen.getByText("One year")).toBeTruthy();
    expect(screen.getByText("Material")).toBeTruthy();
    expect(screen.getByText("Cotton")).toBeTruthy();
    expect(screen.getByText("Product details from the seller.")).toBeTruthy();
    expect(screen.getByText("Detailed description")).toBeTruthy();
  });

  it("keeps missing facts and long trust content readable without fake metrics", async () => {
    queryMocks.productDetailResponse = {
      ...createProductDetailFixture(),
      description: "A very long product description with manual line breaks.\nUse this to verify readable wrapping.",
      shop: { id: "shop-1", name: "Demo Shop With A Very Long Marketplace Display Name", location: "Bangkok metropolitan area with extended location copy" },
      brand: null,
      warrantyInfo: null,
      condition: null,
      countryOfOrigin: null,
      attributes: [],
    };

    renderWithClient(<ProductDetailPage productId="product-1" />);

    expect((await screen.findAllByText("Demo Shop With A Very Long Marketplace Display Name")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Bangkok metropolitan area with extended location copy").length).toBeGreaterThan(0);
    expect(screen.getByText("No product facts provided.")).toBeTruthy();
    expect(screen.queryByText("4 facts")).toBeNull();
    expect(screen.queryByText("ratingCount")).toBeNull();
    expect(screen.getByText(/A very long product description/)).toBeTruthy();
    expect(screen.getByText(/Use this to verify readable wrapping/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Add to cart/ })).toBeTruthy();
  });

  it("does not allow quantity above selected variant stock", async () => {
    renderWithClient(<ProductDetailPage productId="product-1" />);

    await screen.findByRole("button", { name: /Add to cart/ });
    fireEvent.click(screen.getByRole("button", { name: "Red" }));
    fireEvent.click(screen.getByRole("button", { name: "S" }));

    const incrementButton = screen.getByRole("button", { name: "Increase quantity" });
    fireEvent.click(incrementButton);
    fireEvent.click(incrementButton);

    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
    expect(incrementButton).toHaveProperty("disabled", true);
  });

  it("clamps quantity when the selected variant changes to lower stock", async () => {
    renderWithClient(<ProductDetailPage productId="product-1" />);

    await screen.findByRole("button", { name: /Add to cart/ });
    fireEvent.click(screen.getByRole("button", { name: "Red" }));
    fireEvent.click(screen.getByRole("button", { name: "M" }));

    const incrementButton = screen.getByRole("button", { name: "Increase quantity" });
    fireEvent.click(incrementButton);
    fireEvent.click(incrementButton);
    expect(screen.getAllByText("3").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "S" }));

    await waitFor(() => {
      const stickySummary = screen.getByText("Qty").closest("div");
      expect(stickySummary).toBeTruthy();
      expect(within(stickySummary as HTMLElement).getByText("2")).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: "Increase quantity" })).toHaveProperty("disabled", true);
  });

  it("shows buyer purchase CTAs to anonymous visitors", async () => {
    queryMocks.session = null;

    renderWithClient(<ProductDetailPage productId="product-1" />);

    expect(await screen.findByRole("button", { name: /Add to cart/ })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /Buy now/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Log in to add this item to your cart.").length).toBeGreaterThan(0);
    expect(screen.queryByText("Seller inbox")).toBeNull();
  });

  it("disables product detail purchase actions for non-buyer accounts with a reason", async () => {
    queryMocks.session = { user: { role: "SELLER" } };

    renderWithClient(<ProductDetailPage productId="product-1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Red" }));
    fireEvent.click(screen.getByRole("button", { name: "M" }));

    const addToCart = screen.getByRole("button", { name: /Add to cart/ });
    const buyNow = screen.getByRole("button", { name: /Buy now/ });

    expect(addToCart).toHaveProperty("disabled", true);
    expect(buyNow).toHaveProperty("disabled", true);
    expect(addToCart).toHaveProperty("title", "Only buyer accounts can purchase.");
    expect(screen.getAllByText("Only buyer accounts can purchase.").length).toBeGreaterThan(0);
  });

  it("routes anonymous buyers to login with the current product path before mutating", async () => {
    queryMocks.session = null;

    renderWithClient(<ProductDetailPage productId="product-1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Red" }));
    fireEvent.click(screen.getByRole("button", { name: "M" }));
    fireEvent.click(screen.getByRole("button", { name: /Add to cart/ }));

    expect(queryMocks.routerPush).toHaveBeenCalledWith("/en/login?next=%2Fproducts%2Fproduct-1");
    expect(queryMocks.addCartItem).not.toHaveBeenCalled();
    expect(queryMocks.showAddToCartSuccess).not.toHaveBeenCalled();
    expect(queryMocks.showAddToCartError).not.toHaveBeenCalled();
  });

  it("allows selecting standalone variants when no option groups are available", async () => {
    queryMocks.productDetailResponse = {
      ...createProductDetailFixture(),
      options: [],
    };

    renderWithClient(<ProductDetailPage productId="product-1" />);

    const addToCart = await screen.findByRole("button", { name: /Add to cart/ });
    expect(addToCart).toHaveProperty("disabled", true);
    expect(screen.getAllByText("Select a variant before purchasing.").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Red / M" }));

    expect(await screen.findAllByText(/SKU RED-M/)).toHaveLength(2);
    expect(addToCart).toHaveProperty("disabled", false);

    fireEvent.click(addToCart);

    await waitFor(() => expect(queryMocks.addCartItem).toHaveBeenCalledWith("variant-red-m", 1));
  });

  it("renders rating summary, review cards, media, date, and purchased item snapshot", async () => {
    queryMocks.ratingSummaryResponse = {
      averageRating: 4.5,
      totalReviewCount: 2,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 },
    };
    queryMocks.reviewsResponse = { items: [{
      id: "review-1",
      reviewerName: "Jane Buyer",
      rating: 5,
      comment: "Great material and fast delivery.",
      media: [{ id: "media-1", type: "IMAGE", url: "/uploads/review_image/review-1/front.jpg", altText: "front view", sortOrder: 0 }],
      createdAt: "2026-01-02T03:04:05.000Z",
      snapshot: {
        productTitle: "Variant Product",
        variantTitle: "Red / M",
        variantSku: "RED-M",
        shopName: "Demo Shop",
      },
    }], meta: { page: 1, limit: 5, totalCount: 1, hasNextPage: false } };

    renderWithClient(<ProductDetailPage productId="product-1" />);

    expect(await screen.findByText("Jane Buyer")).toBeTruthy();
    expect(screen.getAllByText("4.5").length).toBeGreaterThan(0);
    expect(screen.getByText("2 reviews")).toBeTruthy();
    expect(screen.getByText("Great material and fast delivery.")).toBeTruthy();
    expect(screen.getByAltText("front view").getAttribute("src")).toBe("/uploads/review_image/review-1/front.jpg");
    expect(screen.getByText("Jan 2, 2026")).toBeTruthy();
    expect(screen.getAllByText("Variant Product").length).toBeGreaterThan(1);
    expect(screen.getByText("Red / M | SKU RED-M | Demo Shop")).toBeTruthy();
  });

  it("renders empty review state when no published reviews exist", async () => {
    renderWithClient(<ProductDetailPage productId="product-1" />);

    expect(await screen.findByText("No reviews yet")).toBeTruthy();
    expect(screen.getByText("Published buyer reviews will appear here.")).toBeTruthy();
    expect(screen.getByText("0 reviews")).toBeTruthy();
  });

  it("renders review discovery controls and loads additional review pages", async () => {
    queryMocks.ratingSummaryResponse = {
      averageRating: 5,
      totalReviewCount: 2,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 2 },
    };
    queryMocks.reviewsResponsesByPage.set(1, {
      items: [{
        id: "review-1",
        reviewerName: "First Buyer",
        rating: 5,
        comment: "First review",
        media: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        snapshot: null,
      }],
      meta: { page: 1, limit: 1, totalCount: 2, hasNextPage: true },
    });
    queryMocks.reviewsResponsesByPage.set(2, {
      items: [{
        id: "review-2",
        reviewerName: "Second Buyer",
        rating: 5,
        comment: "Second review",
        media: [],
        createdAt: "2026-01-02T00:00:00.000Z",
        snapshot: null,
      }],
      meta: { page: 2, limit: 1, totalCount: 2, hasNextPage: false },
    });

    renderWithClient(<ProductDetailPage productId="product-1" />);

    expect(await screen.findByText("All ratings")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Load more reviews" }));

    expect(await screen.findByText("Second Buyer")).toBeTruthy();
    expect(screen.getByText("First Buyer")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "With media" }));
    fireEvent.click(screen.getByRole("button", { name: "Rating high" }));

    await waitFor(() => expect(queryMocks.reviewsQueryFn).toHaveBeenCalledWith(expect.objectContaining({
      hasMedia: true,
      sort: "rating_desc",
      page: 1,
    })));
  });

  it("renders review and rating summary error states with retry actions", async () => {
    queryMocks.ratingSummaryError = new Error("summary unavailable");
    queryMocks.reviewsError = new Error("reviews unavailable");

    renderWithClient(<ProductDetailPage productId="product-1" />);

    expect(await screen.findByText("summary unavailable")).toBeTruthy();
    expect(screen.getByText("reviews unavailable")).toBeTruthy();

    queryMocks.ratingSummaryError = null;
    queryMocks.ratingSummaryResponse = {
      averageRating: 5,
      totalReviewCount: 1,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 },
    };
    queryMocks.reviewsError = null;
    queryMocks.reviewsResponse = { items: [{
      id: "review-recovered",
      reviewerName: "Recovered Buyer",
      rating: 5,
      comment: "Recovered review",
      media: [],
      createdAt: "2026-02-03T00:00:00.000Z",
      snapshot: null,
    }], meta: { page: 1, limit: 5, totalCount: 1, hasNextPage: false } };

    const retryButtons = screen.getAllByRole("button", { name: /Retry/ });
    fireEvent.click(retryButtons[0]!);
    fireEvent.click(retryButtons[1]!);

    expect(await screen.findByText("Recovered Buyer")).toBeTruthy();
    expect(screen.getByText("5.0")).toBeTruthy();
  });

  it("renders readable review and Q&A fallback messages when API errors contain object payloads", async () => {
    queryMocks.reviewsError = { message: { code: "REVIEWS_UNAVAILABLE" } };
    queryMocks.questionsError = { error: { code: "QUESTIONS_UNAVAILABLE" } };

    renderWithClient(<ProductDetailPage productId="product-1" />);

    expect(await screen.findByText("Reviews are temporarily unavailable.")).toBeTruthy();
    expect(screen.getByText("Questions are temporarily unavailable.")).toBeTruthy();
    expect(screen.queryByText("[object Object]")).toBeNull();
  });

  it("renders populated Q&A with seller answers", async () => {
    queryMocks.questionsResponse = {
      items: [{
        id: "question-1",
        productId: "product-1",
        shopId: "shop-1",
        question: "Does this include a dust bag?",
        status: "PUBLISHED",
        createdAt: "2026-01-04T00:00:00.000Z",
        user: { id: "buyer-1", name: "Jane Buyer" },
        answers: [{
          id: "answer-1",
          answer: "Yes, the dust bag is included.",
          status: "PUBLISHED",
          createdAt: "2026-01-05T00:00:00.000Z",
          user: { id: "seller-1", name: "Demo Shop" },
        }],
      }],
      meta: { page: 1, limit: 5, totalCount: 1, hasNextPage: false },
    };

    renderWithClient(<ProductDetailPage productId="product-1" />);

    expect(await screen.findByText("Questions & answers")).toBeTruthy();
    expect(screen.getByText("Does this include a dust bag?")).toBeTruthy();
    expect(screen.getByText("Seller answer from Demo Shop")).toBeTruthy();
    expect(screen.getByText("Yes, the dust bag is included.")).toBeTruthy();
  });

  it("renders empty Q&A state when no questions exist", async () => {
    renderWithClient(<ProductDetailPage productId="product-1" />);

    expect(await screen.findByText("No questions yet")).toBeTruthy();
    expect(screen.getByText("Buyer questions and seller answers will appear here.")).toBeTruthy();
  });

  it("renders Q&A discovery controls and loads additional question pages", async () => {
    queryMocks.questionsResponsesByPage.set(1, {
      items: [{
        id: "question-1",
        productId: "product-1",
        shopId: "shop-1",
        question: "First question?",
        status: "PUBLISHED",
        createdAt: "2026-01-01T00:00:00.000Z",
        user: { id: "buyer-1", name: "Buyer" },
        answers: [],
      }],
      meta: { page: 1, limit: 1, totalCount: 2, hasNextPage: true },
    });
    queryMocks.questionsResponsesByPage.set(2, {
      items: [{
        id: "question-2",
        productId: "product-1",
        shopId: "shop-1",
        question: "Second question?",
        status: "PUBLISHED",
        createdAt: "2026-01-02T00:00:00.000Z",
        user: { id: "buyer-2", name: "Buyer 2" },
        answers: [],
      }],
      meta: { page: 2, limit: 1, totalCount: 2, hasNextPage: false },
    });

    renderWithClient(<ProductDetailPage productId="product-1" />);

    expect(await screen.findByText("All questions")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Load more questions" }));

    expect(await screen.findByText("Second question?")).toBeTruthy();
    expect(screen.getByText("First question?")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Answered" }));
    fireEvent.click(screen.getByRole("button", { name: "Oldest" }));

    await waitFor(() => expect(queryMocks.questionsQueryFn).toHaveBeenCalledWith(expect.objectContaining({
      answerStatus: "answered",
      sort: "oldest",
      page: 1,
    })));
  });

  it("renders related and recently viewed products while excluding the current product", async () => {
    queryMocks.relatedResponse = {
      items: [
        createProductCardFixture({ id: "product-1", title: "Current product duplicate" }),
        createProductCardFixture({ id: "related-1", title: "Related Bag" }),
      ],
    };
    queryMocks.recentlyViewedResponse = [
      createRecentlyViewedFixture({ productId: "product-1", title: "Current recent duplicate" }),
      createRecentlyViewedFixture({ productId: "recent-1", title: "Recent Hat" }),
    ];

    renderWithClient(<ProductDetailPage productId="product-1" />);

    expect(await screen.findByText("Related Bag")).toBeTruthy();
    expect(screen.getByText("Recent Hat")).toBeTruthy();
    expect(screen.queryByText("Current product duplicate")).toBeNull();
    expect(screen.queryByText("Current recent duplicate")).toBeNull();
  });

  it("renders quiet empty states for related and recently viewed products", async () => {
    renderWithClient(<ProductDetailPage productId="product-1" />);

    expect(await screen.findByText("No related products yet")).toBeTruthy();
    expect(screen.getByText("No recently viewed products")).toBeTruthy();
  });

  it("keeps product detail usable when discovery sections fail", async () => {
    queryMocks.relatedError = new Error("related unavailable");
    queryMocks.recentlyViewedError = new Error("recent unavailable");

    renderWithClient(<ProductDetailPage productId="product-1" />);

    expect((await screen.findAllByText("Variant Product")).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Add to cart/ })).toBeTruthy();
    expect(screen.getByText("Related products are temporarily unavailable.")).toBeTruthy();
    expect(screen.getByText("Recently viewed are temporarily unavailable.")).toBeTruthy();
  });

  it("submits buyer questions with pending and success states", async () => {
    let resolveQuestion: (value: { id: string }) => void = () => {};
    queryMocks.createProductQuestion.mockImplementation(() => new Promise((resolve) => {
      resolveQuestion = resolve;
    }));

    renderWithClient(<ProductDetailPage productId="product-1" />);

    fireEvent.change(await screen.findByLabelText("Your question"), { target: { value: "Is this gift wrapped?" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit question" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Submitting..." })).toHaveProperty("disabled", true));
    expect(queryMocks.createProductQuestion).toHaveBeenCalledWith("product-1", "Is this gift wrapped?");

    resolveQuestion({ id: "question-new" });
    expect(await screen.findByText("Question submitted.")).toBeTruthy();
  });
});

function createProductDetailFixture() {
  return {
    id: "product-1",
    title: "Variant Product",
    description: "Detailed description",
    price: 1200,
    minPrice: 1200,
    maxPrice: 1500,
    currency: "THB",
    rating: 4.5,
    soldCount: 8,
    stock: 5,
    originalPrice: 1800,
    discountPercent: 17,
    shop: { id: "shop-1", name: "Demo Shop", location: "Bangkok" },
    brand: { id: "brand-1", name: "Demo Brand", slug: "demo-brand" },
    metaTitle: null,
    metaDescription: null,
    warrantyInfo: "One year",
    condition: "New",
    countryOfOrigin: "TH",
    highlights: ["Ships fast"],
    attributes: [{ key: "material", name: "Material", value: "Cotton", isFilterable: true }],
    images: ["/image-1.jpg", "/image-2.jpg"],
    video: { url: "/video.mp4", contentType: "video/mp4", fileName: "video.mp4" },
    options: [
      {
        id: "option-color",
        name: "Color",
        values: [
          { id: "value-red", value: "Red", colorHex: "#ff0000" },
          { id: "value-blue", value: "Blue", colorHex: "#0000ff" },
          { id: "value-green", value: "Green", colorHex: "#00aa55" },
        ],
      },
      {
        id: "option-size",
        name: "Size",
        values: [
          { id: "value-s", value: "S", colorHex: null },
          { id: "value-m", value: "M", colorHex: null },
        ],
      },
    ],
    variants: [
      {
        id: "variant-red-s",
        title: "Red / S",
        sku: "RED-S",
        price: 1200,
        currency: "THB",
        stock: 2,
        optionValues: [
          { optionId: "option-color", optionName: "Color", valueId: "value-red", value: "Red", colorHex: "#ff0000" },
          { optionId: "option-size", optionName: "Size", valueId: "value-s", value: "S", colorHex: null },
        ],
      },
      {
        id: "variant-red-m",
        title: "Red / M",
        sku: "RED-M",
        price: 1500,
        currency: "THB",
        stock: 3,
        optionValues: [
          { optionId: "option-color", optionName: "Color", valueId: "value-red", value: "Red", colorHex: "#ff0000" },
          { optionId: "option-size", optionName: "Size", valueId: "value-m", value: "M", colorHex: null },
        ],
      },
      {
        id: "variant-blue-s",
        title: "Blue / S",
        sku: "BLUE-S",
        price: 1300,
        currency: "THB",
        stock: 0,
        optionValues: [
          { optionId: "option-color", optionName: "Color", valueId: "value-blue", value: "Blue", colorHex: "#0000ff" },
          { optionId: "option-size", optionName: "Size", valueId: "value-s", value: "S", colorHex: null },
        ],
      },
    ],
  };
}

function createProductCardFixture(overrides: Partial<ReturnType<typeof createProductDetailFixture>> = {}) {
  return {
    ...createProductDetailFixture(),
    ...overrides,
    options: [],
    variants: [{
      id: `${overrides.id ?? "related"}-variant`,
      title: "Default",
      sku: "DEFAULT",
      price: 1000,
      currency: "THB",
      stock: 5,
      optionValues: [],
    }],
  };
}

function createRecentlyViewedFixture(overrides: Partial<{
  productId: string;
  title: string;
  imageUrl: string | null;
  href: string;
  minPrice: number | null;
  currency: string | null;
  shop: { id: string; name: string };
  viewedAt: string | null;
}> = {}) {
  const productId = overrides.productId ?? "recent-1";
  return {
    productId,
    title: overrides.title ?? "Recent Product",
    imageUrl: overrides.imageUrl ?? "/recent.jpg",
    href: overrides.href ?? `/products/${productId}`,
    minPrice: overrides.minPrice ?? 1000,
    currency: overrides.currency ?? "THB",
    shop: overrides.shop ?? { id: "shop-1", name: "Demo Shop" },
    viewedAt: overrides.viewedAt ?? "2026-01-01T00:00:00.000Z",
  };
}
