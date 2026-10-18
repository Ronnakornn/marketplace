# Task 1: cart reads

Owner: optimize_cart. Scope: server/modules/cart and directly affected test doubles.

Use ID-only active-cart creation/lookup before locking. Keep User creation serialization, Cart/CartItem locks and one full locked snapshot. Reuse that snapshot plus saved mutation rows for update/delete/clear responses. Preserve exact totals, ordering, ownership, stock checks and error behavior. Remove obsolete repository methods with their callers. Verify response, ownership, concurrent creation and mutation behavior with focused tests.
