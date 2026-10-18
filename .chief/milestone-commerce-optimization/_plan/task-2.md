# Task 2: checkout promotion reads

Owner: optimize_checkout. Scope: checkout module and affected repository test doubles.

Replace singular active Flash Sale lookup with a batch projection carrying variant identity. Preserve earliest-ending selection. Commitment locks selected IDs in stable order and revalidates held candidates before pricing. Never use an unlocked replacement. Preserve promotion admission, quote acceptance, inventory/quota holds and transaction rollback. Verify multi-item batching, price changes, deactivation, lock order and existing checkout behavior.
