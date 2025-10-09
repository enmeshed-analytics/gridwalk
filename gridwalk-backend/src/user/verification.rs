use crate::user::{GlobalRole, User, UserStatus};
use chrono::{DateTime, Utc};
use sqlx::Row;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct VerificationCode {
    pub id: Uuid,
    pub user_id: Uuid,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

impl<'r> sqlx::FromRow<'r, sqlx::postgres::PgRow> for VerificationCode {
    fn from_row(row: &'r sqlx::postgres::PgRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            user_id: row.try_get("user_id")?,
            expires_at: row.try_get("expires_at")?,
            created_at: row.try_get("created_at")?,
        })
    }
}

impl VerificationCode {
    pub fn new(user_id: Uuid) -> Self {
        Self {
            id: Uuid::new_v4(), // This serves as the verification token
            user_id,
            expires_at: Utc::now() + chrono::Duration::hours(24),
            created_at: Utc::now(),
        }
    }

    pub async fn save(&self, pg_pool: &sqlx::PgPool) -> Result<(), sqlx::Error> {
        let query = "
            INSERT INTO gridwalk.verification_codes (id, user_id, expires_at, created_at)
            VALUES ($1, $2, $3, $4)";

        sqlx::query(query)
            .bind(&self.id)
            .bind(&self.user_id)
            .bind(&self.expires_at)
            .bind(&self.created_at)
            .execute(pg_pool)
            .await?;

        Ok(())
    }

    pub async fn from_token_with_user(
        pg_pool: &sqlx::PgPool,
        token: &Uuid,
    ) -> Result<Option<(Self, User)>, sqlx::Error> {
        let query = "
            SELECT 
                vc.id, vc.user_id, vc.expires_at, vc.created_at,
                u.id as user_id, u.email, u.first_name, u.last_name, u.global_role, 
                u.created_at as user_created_at, u.updated_at as user_updated_at, 
                u.status::text as status
            FROM gridwalk.verification_codes vc
            JOIN gridwalk.users u ON vc.user_id = u.id
            WHERE vc.id = $1 AND vc.expires_at > CURRENT_TIMESTAMP";

        let row = sqlx::query(query)
            .bind(token)
            .fetch_optional(pg_pool)
            .await?;

        if let Some(row) = row {
            let verification_code = VerificationCode {
                id: row.try_get("id")?,
                user_id: row.try_get("user_id")?,
                expires_at: row.try_get("expires_at")?,
                created_at: row.try_get("created_at")?,
            };

            let role_str: Option<String> = row.try_get("global_role")?;
            let global_role = role_str.map(|role| role.parse::<GlobalRole>().unwrap());
            let status_str: String = row.try_get("status")?;
            let status = status_str.parse::<UserStatus>().unwrap();

            let user = User {
                id: row.try_get("user_id")?,
                email: row.try_get("email")?,
                first_name: row.try_get("first_name")?,
                last_name: row.try_get("last_name")?,
                global_role,
                created_at: row.try_get("user_created_at")?,
                updated_at: row.try_get("user_updated_at")?,
                status,
                notes: None,
            };

            Ok(Some((verification_code, user)))
        } else {
            Ok(None)
        }
    }

    pub async fn cleanup_expired(pg_pool: &sqlx::PgPool) -> Result<u64, sqlx::Error> {
        let query = "DELETE FROM gridwalk.verification_codes WHERE expires_at <= CURRENT_TIMESTAMP";
        let result = sqlx::query(query).execute(pg_pool).await?;
        Ok(result.rows_affected())
    }

    pub async fn delete_for_user(
        pg_pool: &sqlx::PgPool,
        user_id: &Uuid,
    ) -> Result<u64, sqlx::Error> {
        let query = "DELETE FROM gridwalk.verification_codes WHERE user_id = $1";
        let result = sqlx::query(query).bind(user_id).execute(pg_pool).await?;
        Ok(result.rows_affected())
    }

    pub async fn cleanup_old_codes_for_user(
        pg_pool: &sqlx::PgPool,
        user_id: &Uuid,
    ) -> Result<(), sqlx::Error> {
        let query = "
            DELETE FROM gridwalk.verification_codes 
            WHERE user_id = $1 
            AND id NOT IN (
                SELECT id FROM gridwalk.verification_codes 
                WHERE user_id = $1 
                ORDER BY created_at DESC 
                LIMIT 5
            )";

        sqlx::query(query).bind(user_id).execute(pg_pool).await?;
        Ok(())
    }
}
