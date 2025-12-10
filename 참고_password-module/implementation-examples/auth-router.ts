/**
 * 비밀번호 변경 모듈 - tRPC 라우터 구현 예시
 * 
 * 이 파일은 비밀번호 찾기, 재설정, 변경 기능을 구현한 tRPC 라우터입니다.
 * 다른 시스템에 통합할 때 이 코드를 참고하여 구현하세요.
 */

import { router, publicProcedure, protectedProcedure } from '../_core/trpc';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { TRPCError } from '@trpc/server';
import { 
  findUserByEmail, 
  findUserById, 
  createResetToken, 
  findResetToken, 
  invalidateResetToken,
  invalidateUserResetTokens,
  updateUserPassword 
} from '../db';
import { sendPasswordResetEmail, sendPasswordChangedEmail } from '../services/email';

/**
 * 재설정 토큰 생성 함수
 * 암호학적으로 안전한 32바이트 난수를 생성합니다.
 */
function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * 비밀번호 강도 검증 함수
 * 최소 8자, 대소문자+숫자+특수문자 중 3가지 이상 포함
 */
function validatePasswordStrength(password: string): boolean {
  if (password.length < 8) return false;
  
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  const criteriaCount = [hasUpperCase, hasLowerCase, hasNumber, hasSpecialChar]
    .filter(Boolean).length;
  
  return criteriaCount >= 3;
}

export const authRouter = router({
  /**
   * 비밀번호 찾기
   * 
   * 사용자가 이메일을 입력하면 재설정 링크를 이메일로 발송합니다.
   * 보안상 사용자가 존재하지 않더라도 동일한 응답을 반환합니다.
   */
  forgotPassword: publicProcedure
    .input(z.object({
      email: z.string().email('유효한 이메일 주소를 입력해주세요.'),
    }))
    .mutation(async ({ input }) => {
      const { email } = input;
      
      // Rate limiting 체크 (실제 구현 시 Redis 등 사용)
      // TODO: 5분 내 3회 이상 요청 시 차단
      
      // 사용자 조회
      const user = await findUserByEmail(email);
      
      // 사용자가 존재하지 않아도 동일한 응답 반환 (타이밍 공격 방지)
      if (!user) {
        // 가짜 해싱 작업으로 처리 시간 맞추기
        await bcrypt.hash('dummy-password', 10);
        
        return {
          success: true,
          message: '이메일을 확인해주세요. 비밀번호 재설정 링크를 발송했습니다.',
        };
      }
      
      // 기존 토큰 무효화
      await invalidateUserResetTokens(user.id);
      
      // 새 토큰 생성
      const token = generateResetToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1시간 후
      
      // 토큰 저장
      await createResetToken(user.id, token, expiresAt);
      
      // 이메일 발송
      const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
      
      try {
        await sendPasswordResetEmail(user.email, resetLink);
      } catch (error) {
        console.error('[AUTH] Failed to send password reset email:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: '이메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.',
        });
      }
      
      return {
        success: true,
        message: '이메일을 확인해주세요. 비밀번호 재설정 링크를 발송했습니다.',
      };
    }),

  /**
   * 비밀번호 재설정
   * 
   * 이메일로 받은 토큰을 사용하여 새로운 비밀번호를 설정합니다.
   */
  resetPassword: publicProcedure
    .input(z.object({
      token: z.string().min(1, '토큰이 필요합니다.'),
      newPassword: z.string().min(8, '비밀번호는 최소 8자 이상이어야 합니다.'),
      confirmPassword: z.string(),
    }))
    .mutation(async ({ input }) => {
      const { token, newPassword, confirmPassword } = input;
      
      // 비밀번호 확인
      if (newPassword !== confirmPassword) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '비밀번호 확인이 일치하지 않습니다.',
        });
      }
      
      // 비밀번호 강도 검증
      if (!validatePasswordStrength(newPassword)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '비밀번호는 최소 8자 이상이며, 대소문자, 숫자, 특수문자 중 3가지 이상을 포함해야 합니다.',
        });
      }
      
      // 토큰 조회
      const resetToken = await findResetToken(token);
      
      if (!resetToken) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '유효하지 않은 재설정 링크입니다. 다시 요청해주세요.',
        });
      }
      
      // 토큰 만료 확인
      if (new Date() > resetToken.expiresAt) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '재설정 링크가 만료되었습니다. 다시 요청해주세요.',
        });
      }
      
      // 토큰 사용 여부 확인
      if (resetToken.usedAt) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '이미 사용된 재설정 링크입니다. 다시 요청해주세요.',
        });
      }
      
      // 비밀번호 해싱
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      // 비밀번호 업데이트
      await updateUserPassword(resetToken.userId, hashedPassword);
      
      // 토큰 무효화
      await invalidateResetToken(token);
      
      // 알림 이메일 발송 (선택사항)
      try {
        const user = await findUserById(resetToken.userId);
        if (user) {
          await sendPasswordChangedEmail(user.email);
        }
      } catch (error) {
        console.error('[AUTH] Failed to send password changed email:', error);
        // 이메일 발송 실패는 무시 (비밀번호는 이미 변경됨)
      }
      
      return {
        success: true,
        message: '비밀번호가 성공적으로 변경되었습니다. 새 비밀번호로 로그인해주세요.',
      };
    }),

  /**
   * 비밀번호 변경
   * 
   * 로그인 상태에서 현재 비밀번호를 확인한 후 새로운 비밀번호로 변경합니다.
   */
  changePassword: protectedProcedure // 인증 필요
    .input(z.object({
      currentPassword: z.string().min(1, '현재 비밀번호를 입력해주세요.'),
      newPassword: z.string().min(8, '새 비밀번호는 최소 8자 이상이어야 합니다.'),
      confirmPassword: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { currentPassword, newPassword, confirmPassword } = input;
      const userId = ctx.user.id; // 인증된 사용자 ID
      
      // 비밀번호 확인
      if (newPassword !== confirmPassword) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '비밀번호 확인이 일치하지 않습니다.',
        });
      }
      
      // 비밀번호 강도 검증
      if (!validatePasswordStrength(newPassword)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '비밀번호는 최소 8자 이상이며, 대소문자, 숫자, 특수문자 중 3가지 이상을 포함해야 합니다.',
        });
      }
      
      // 사용자 조회
      const user = await findUserById(userId);
      
      if (!user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: '사용자를 찾을 수 없습니다.',
        });
      }
      
      // 현재 비밀번호 검증
      const isValid = await bcrypt.compare(currentPassword, user.hashedPassword);
      
      if (!isValid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '현재 비밀번호가 일치하지 않습니다.',
        });
      }
      
      // 새 비밀번호가 현재 비밀번호와 동일한지 확인
      const isSameAsOld = await bcrypt.compare(newPassword, user.hashedPassword);
      
      if (isSameAsOld) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '새 비밀번호는 현재 비밀번호와 달라야 합니다.',
        });
      }
      
      // 새 비밀번호 해싱
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      // 비밀번호 업데이트
      await updateUserPassword(userId, hashedPassword);
      
      // 알림 이메일 발송
      try {
        await sendPasswordChangedEmail(user.email);
      } catch (error) {
        console.error('[AUTH] Failed to send password changed email:', error);
        // 이메일 발송 실패는 무시 (비밀번호는 이미 변경됨)
      }
      
      // 선택사항: 모든 활성 세션 무효화
      // await invalidateAllUserSessions(userId);
      
      return {
        success: true,
        message: '비밀번호가 성공적으로 변경되었습니다.',
      };
    }),

  /**
   * 재설정 토큰 검증 (선택사항)
   * 
   * 비밀번호 재설정 페이지 로드 시 토큰 유효성을 미리 확인합니다.
   */
  verifyResetToken: publicProcedure
    .input(z.object({
      token: z.string(),
    }))
    .query(async ({ input }) => {
      const { token } = input;
      
      const resetToken = await findResetToken(token);
      
      if (!resetToken) {
        return {
          valid: false,
          error: 'INVALID_TOKEN',
          message: '유효하지 않은 재설정 링크입니다.',
        };
      }
      
      if (new Date() > resetToken.expiresAt) {
        return {
          valid: false,
          error: 'TOKEN_EXPIRED',
          message: '재설정 링크가 만료되었습니다.',
        };
      }
      
      if (resetToken.usedAt) {
        return {
          valid: false,
          error: 'TOKEN_ALREADY_USED',
          message: '이미 사용된 재설정 링크입니다.',
        };
      }
      
      return {
        valid: true,
        message: '유효한 재설정 링크입니다.',
      };
    }),
});
