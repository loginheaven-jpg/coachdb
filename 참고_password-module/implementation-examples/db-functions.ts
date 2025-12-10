/**
 * 비밀번호 변경 모듈 - 데이터베이스 함수 구현 예시
 * 
 * 이 파일은 Drizzle ORM을 사용한 데이터베이스 함수 구현 예시입니다.
 * 다른 ORM(Prisma, TypeORM 등)을 사용하는 경우 이 로직을 참고하여 구현하세요.
 */

import { db } from './db';
import { users, passwordResetTokens } from './schema';
import { eq, and, lt } from 'drizzle-orm';

/**
 * 이메일로 사용자 조회
 */
export async function findUserByEmail(email: string) {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  
  return result[0] || null;
}

/**
 * ID로 사용자 조회
 */
export async function findUserById(id: number) {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  
  return result[0] || null;
}

/**
 * 재설정 토큰 생성
 */
export async function createResetToken(
  userId: number,
  token: string,
  expiresAt: Date
) {
  const result = await db
    .insert(passwordResetTokens)
    .values({
      userId,
      token,
      expiresAt,
    })
    .returning();
  
  return result[0];
}

/**
 * 토큰으로 재설정 토큰 조회
 */
export async function findResetToken(token: string) {
  const result = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.token, token))
    .limit(1);
  
  return result[0] || null;
}

/**
 * 토큰 무효화 (사용 완료 표시)
 */
export async function invalidateResetToken(token: string) {
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.token, token));
}

/**
 * 사용자의 모든 재설정 토큰 무효화
 * 새로운 재설정 요청 시 기존 토큰을 모두 무효화합니다.
 */
export async function invalidateUserResetTokens(userId: number) {
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(passwordResetTokens.userId, userId),
        eq(passwordResetTokens.usedAt, null) // 미사용 토큰만
      )
    );
}

/**
 * 사용자 비밀번호 업데이트
 */
export async function updateUserPassword(userId: number, hashedPassword: string) {
  await db
    .update(users)
    .set({ 
      hashedPassword,
      updatedAt: new Date() 
    })
    .where(eq(users.id, userId));
}

/**
 * 만료된 토큰 삭제 (정리 작업)
 * Cron job으로 주기적으로 실행합니다.
 */
export async function deleteExpiredTokens() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  const result = await db
    .delete(passwordResetTokens)
    .where(lt(passwordResetTokens.expiresAt, sevenDaysAgo));
  
  return result.rowCount || 0;
}

/**
 * 사용자의 비밀번호 히스토리 저장 (선택사항)
 * 이전 비밀번호 재사용을 방지하기 위해 사용합니다.
 */
export async function savePasswordHistory(userId: number, hashedPassword: string) {
  // passwordHistory 테이블이 있는 경우
  // await db.insert(passwordHistory).values({ userId, hashedPassword });
}

/**
 * 사용자의 이전 비밀번호 확인 (선택사항)
 * 새 비밀번호가 최근 N개의 비밀번호와 다른지 확인합니다.
 */
export async function checkPasswordHistory(
  userId: number, 
  newPassword: string,
  count: number = 5
): Promise<boolean> {
  // passwordHistory 테이블이 있는 경우
  // const history = await db
  //   .select()
  //   .from(passwordHistory)
  //   .where(eq(passwordHistory.userId, userId))
  //   .orderBy(desc(passwordHistory.createdAt))
  //   .limit(count);
  //
  // for (const record of history) {
  //   const isSame = await bcrypt.compare(newPassword, record.hashedPassword);
  //   if (isSame) return false; // 이전 비밀번호와 동일
  // }
  
  return true; // 이전 비밀번호와 다름
}
