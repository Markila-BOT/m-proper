// api/tests/ownership.rs
//!
//! Real-database checks for ownership isolation and the closed direct Data API
//! path (ADR 0008). The verifier's token matrix and the route's own query text
//! are already covered by unit tests; what only a real database can prove is
//! that the constraints, grants, and policies hold there.
//!
//! These tests do nothing unless the process environment supplies a database,
//! so `cargo test` stays green offline. To run them:
//!
//! ```text
//! cd api
//! DATABASE_URL='postgresql://…' \
//! TEST_OWNER_A_ID='<seeded landlord A uuid>' \
//! TEST_OWNER_B_ID='<seeded landlord B uuid>' \
//! cargo test --test ownership -- --ignored
//! ```
//!
//! `TEST_OWNER_A_ID` and `TEST_OWNER_B_ID` are the ids printed by
//! `pnpm run seed:auth` (`ownerAId` / `ownerBId`). Nothing is read from `.env`:
//! an integration test that silently loaded `api/.env` would start touching the
//! live database from a plain `cargo test`, which is exactly what must not
//! happen.
//!
//! What it touches: only rows it creates itself, named `ownership-test-<tag>-…`
//! with a fresh tag per test. Cleanup deletes those names even when an
//! assertion panics. It never reads, updates, or deletes an existing row such as
//! `Colinas Verdes`, and it runs no migrations.

use std::{env, future::Future, time::Duration};

use sqlx::{PgPool, postgres::PgPoolOptions};
use uuid::Uuid;

/// The prefix every row this suite creates carries. Cleanup matches the prefix
/// plus the run's own tag, so parallel tests and pre-existing rows are never in
/// scope.
const NAME_PREFIX: &str = "ownership-test";

/// Mirrors `LIST_OWNED_PROPERTIES_SQL` in `api/src/routes/properties.rs`. The
/// test crate cannot import a binary's private constants, so the predicate is
/// restated; the route's unit tests keep its text pinned in step with this.
const LIST_OWNED_PROPERTIES_SQL: &str = r#"
    SELECT name
    FROM properties
    WHERE owner_id = $1
    ORDER BY is_active DESC, created_at DESC
"#;

/// Mirrors `DELETE_OWNED_PROPERTY_SQL`: the id and the owner are matched
/// together, which is what makes a foreign row indistinguishable from an
/// unknown one.
const DELETE_OWNED_PROPERTY_SQL: &str = "DELETE FROM properties WHERE id = $1 AND owner_id = $2";

/// The owned rows one test created, together with the connection it used.
///
/// Cloned into the guarded task, while the original stays behind to clean up:
/// that is what makes cleanup survive a failed assertion.
#[derive(Clone)]
struct Scope {
    pool: PgPool,
    owner_a: Uuid,
    owner_b: Uuid,
    tag: String,
}

struct OwnedRow {
    id: Uuid,
    name: String,
}

impl Scope {
    /// Connects when the environment provides a database and both seeded
    /// landlords; prints why and returns `None` otherwise, so the test is a
    /// skip rather than a failure.
    async fn open() -> Option<Self> {
        let Some(database_url) = env_value("DATABASE_URL") else {
            notice("DATABASE_URL is not set; this test needs the Supabase Postgres it names");
            return None;
        };

        let owner_a = owner_id("TEST_OWNER_A_ID")?;
        let owner_b = owner_id("TEST_OWNER_B_ID")?;

        let pool = PgPoolOptions::new()
            .max_connections(2)
            .acquire_timeout(Duration::from_secs(10))
            .connect(&database_url)
            .await
            .unwrap_or_else(|error| {
                // The variable is set, so a silent skip would hide a broken
                // environment. Fail loudly instead.
                panic!("DATABASE_URL is set but the database is unreachable: {error}")
            });

        Some(Self {
            pool,
            owner_a,
            owner_b,
            // A fresh tag per test keeps parallel tests from seeing, or
            // cleaning up, each other's rows.
            tag: Uuid::new_v4().simple().to_string(),
        })
    }

    fn name(&self, label: &str) -> String {
        format!("{NAME_PREFIX}-{}-{label}", self.tag)
    }

    /// Inserts one property for `owner` and returns its id and name.
    async fn create(&self, owner: Uuid, label: &str) -> OwnedRow {
        let name = self.name(label);

        let id = sqlx::query_scalar::<_, Uuid>(
            "INSERT INTO properties (name, address, type, owner_id)
             VALUES ($1, $2, 'residential', $3)
             RETURNING id",
        )
        .bind(&name)
        .bind(format!("{name} address"))
        .bind(owner)
        .fetch_one(&self.pool)
        .await
        .unwrap_or_else(|error| panic!("seeding {label} for owner {owner} failed: {error}"));

        OwnedRow { id, name }
    }

    /// Deletes every row this test created. Matching on the name pattern alone
    /// (not on the owner) also clears a row an ownerless insert might leave
    /// behind if the `NOT NULL` constraint ever regressed.
    async fn clean_up(&self) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM properties WHERE name LIKE $1")
            .bind(format!("{NAME_PREFIX}-{}-%", self.tag))
            .execute(&self.pool)
            .await?;

        Ok(())
    }
}

/// Runs `checks` in its own task so a failed assertion cannot skip the
/// cleanup, then re-raises the failure. This is the scopeguard-free pattern:
/// the panic is held as a `JoinError`, cleanup runs, and the panic resumes.
async fn with_cleanup<F, Fut>(scope: Scope, checks: F)
where
    F: FnOnce(Scope) -> Fut + Send + 'static,
    Fut: Future<Output = ()> + Send + 'static,
{
    let cleanup_scope = scope.clone();
    let outcome = tokio::spawn(checks(scope)).await;
    let cleaned = cleanup_scope.clean_up().await;

    if let Err(panic) = outcome {
        if let Err(error) = cleaned {
            eprintln!("ownership-test cleanup also failed while unwinding: {error}");
        }
        std::panic::resume_unwind(panic.into_panic());
    }

    if let Err(error) = cleaned {
        panic!("ownership-test cleanup failed: {error}");
    }
}

fn env_value(name: &str) -> Option<String> {
    env::var(name)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn owner_id(name: &str) -> Option<Uuid> {
    let Some(value) = env_value(name) else {
        notice(&format!(
            "{name} is not set; it must hold a seeded landlord's id (see `pnpm run seed:auth`)"
        ));
        return None;
    };

    match Uuid::parse_str(&value) {
        Ok(id) => Some(id),
        Err(_) => {
            notice(&format!(
                "{name} is not a UUID; copy the id printed by `pnpm run seed:auth`"
            ));
            None
        }
    }
}

fn notice(message: &str) {
    eprintln!("ownership integration test skipped: {message}");
}

/// Owner A's listing must not contain owner B's row. The route binds the same
/// predicate; this proves the database answers it the same way.
#[tokio::test]
#[ignore = "needs DATABASE_URL, TEST_OWNER_A_ID and TEST_OWNER_B_ID; run with --ignored"]
async fn a_listing_scoped_to_one_owner_never_returns_another_owners_row() {
    let Some(scope) = Scope::open().await else {
        return;
    };

    with_cleanup(scope, |scope| async move {
        let a_row = scope.create(scope.owner_a, "list-a").await;
        let b_row = scope.create(scope.owner_b, "list-b").await;

        let names = sqlx::query_scalar::<_, String>(LIST_OWNED_PROPERTIES_SQL)
            .bind(scope.owner_a)
            .fetch_all(&scope.pool)
            .await
            .expect("the owner-scoped list should run");

        assert!(
            names.contains(&a_row.name),
            "owner A's own row {} is missing from the listing: {names:?}",
            a_row.name
        );
        assert!(
            !names.contains(&b_row.name),
            "owner B's row {} leaked into owner A's listing: {names:?}",
            b_row.name
        );
    })
    .await;
}

/// Deleting another landlord's row with the wrong owner bound must match zero
/// rows and leave the row untouched: the 404-for-foreign-row rule.
#[tokio::test]
#[ignore = "needs DATABASE_URL, TEST_OWNER_A_ID and TEST_OWNER_B_ID; run with --ignored"]
async fn deleting_with_a_foreign_owner_matches_no_rows() {
    let Some(scope) = Scope::open().await else {
        return;
    };

    with_cleanup(scope, |scope| async move {
        let a_row = scope.create(scope.owner_a, "delete-foreign").await;

        let rows_affected = sqlx::query(DELETE_OWNED_PROPERTY_SQL)
            .bind(a_row.id)
            .bind(scope.owner_b)
            .execute(&scope.pool)
            .await
            .expect("the owner-scoped delete should run")
            .rows_affected();

        assert_eq!(
            rows_affected, 0,
            "owner B must not delete owner A's row {}",
            a_row.id
        );

        let survivors = sqlx::query_scalar::<_, i64>(
            "SELECT count(*) FROM properties WHERE id = $1 AND owner_id = $2",
        )
        .bind(a_row.id)
        .bind(scope.owner_a)
        .fetch_one(&scope.pool)
        .await
        .expect("the survivor check should run");

        assert_eq!(survivors, 1, "the foreign delete removed the row anyway");
    })
    .await;
}

/// The owning account's delete removes exactly one row.
#[tokio::test]
#[ignore = "needs DATABASE_URL, TEST_OWNER_A_ID and TEST_OWNER_B_ID; run with --ignored"]
async fn deleting_with_the_owning_account_removes_exactly_one_row() {
    let Some(scope) = Scope::open().await else {
        return;
    };

    with_cleanup(scope, |scope| async move {
        let a_row = scope.create(scope.owner_a, "delete-own").await;

        let rows_affected = sqlx::query(DELETE_OWNED_PROPERTY_SQL)
            .bind(a_row.id)
            .bind(scope.owner_a)
            .execute(&scope.pool)
            .await
            .expect("the owner-scoped delete should run")
            .rows_affected();

        assert_eq!(rows_affected, 1, "the owner's delete must remove its row");

        let remaining =
            sqlx::query_scalar::<_, i64>("SELECT count(*) FROM properties WHERE id = $1")
                .bind(a_row.id)
                .fetch_one(&scope.pool)
                .await
                .expect("the follow-up count should run");

        assert_eq!(remaining, 0, "the deleted row is still present");
    })
    .await;
}

/// `owner_id` is `NOT NULL`, so a direct insert that omits it is refused. This
/// is the constraint behind "an unowned row cannot exist", not just a convention
/// in the API.
#[tokio::test]
#[ignore = "needs DATABASE_URL, TEST_OWNER_A_ID and TEST_OWNER_B_ID; run with --ignored"]
async fn an_insert_without_an_owner_is_refused() {
    let Some(scope) = Scope::open().await else {
        return;
    };

    with_cleanup(scope, |scope| async move {
        let nullability = sqlx::query_scalar::<_, String>(
            "SELECT is_nullable
             FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name = 'properties'
               AND column_name = 'owner_id'",
        )
        .fetch_optional(&scope.pool)
        .await
        .expect("the column lookup should run");

        assert_eq!(
            nullability.as_deref(),
            Some("NO"),
            "properties.owner_id must be NOT NULL (column missing or nullable)"
        );

        let name = scope.name("insert-ownerless");
        let attempt = sqlx::query(
            "INSERT INTO properties (name, address, type) VALUES ($1, $2, 'residential')",
        )
        .bind(&name)
        .bind(format!("{name} address"))
        .execute(&scope.pool)
        .await;

        match attempt {
            Ok(_) => panic!("an ownerless insert was accepted; owner_id is not NOT NULL"),
            Err(sqlx::Error::Database(error)) => assert_eq!(
                error.code().as_deref(),
                Some("23502"),
                "expected a not-null violation, got {error}"
            ),
            Err(error) => panic!("expected a not-null violation, got {error}"),
        }
    })
    .await;
}

/// The direct Data API path stays closed: `anon` and `authenticated` hold no
/// privilege on `properties`, so a publishable key cannot reach the table even
/// if the Data API is ever re-enabled.
#[tokio::test]
#[ignore = "needs DATABASE_URL, TEST_OWNER_A_ID and TEST_OWNER_B_ID; run with --ignored"]
async fn the_data_api_roles_hold_no_grant_on_properties() {
    let Some(scope) = Scope::open().await else {
        return;
    };

    with_cleanup(scope, |scope| async move {
        let grants = sqlx::query_as::<_, (String, String)>(
            "SELECT grantee, privilege_type
             FROM information_schema.role_table_grants
             WHERE table_schema = 'public'
               AND table_name = 'properties'
               AND grantee IN ('anon', 'authenticated')",
        )
        .fetch_all(&scope.pool)
        .await
        .expect("the grant lookup should run");

        assert!(
            grants.is_empty(),
            "the direct Data API roles still hold grants on properties: {grants:?}"
        );
    })
    .await;
}

/// Guards the regression the follow-up migration fixes: a permissive policy for
/// a client role whose `qual` is `true` would satisfy every row and make the
/// owner-scoped policies decorative.
#[tokio::test]
#[ignore = "needs DATABASE_URL, TEST_OWNER_A_ID and TEST_OWNER_B_ID; run with --ignored"]
async fn no_policy_on_properties_is_permissive_for_a_client_role() {
    let Some(scope) = Scope::open().await else {
        return;
    };

    with_cleanup(scope, |scope| async move {
        let permissive = sqlx::query_scalar::<_, String>(
            "SELECT policyname
             FROM pg_policies
             WHERE schemaname = 'public'
               AND tablename = 'properties'
               AND btrim(qual) = 'true'
               AND roles && ARRAY['public', 'anon', 'authenticated']::name[]",
        )
        .fetch_all(&scope.pool)
        .await
        .expect("the policy lookup should run");

        assert!(
            permissive.is_empty(),
            "permissive policies satisfy every row and neutralise the owner \
             policies; drop them (see \
             20261125000001_properties_drop_permissive_policy.sql): {permissive:?}"
        );
    })
    .await;
}
