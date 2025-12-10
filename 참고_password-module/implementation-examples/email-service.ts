/**
 * 비밀번호 변경 모듈 - 이메일 서비스 구현 예시
 * 
 * 이 파일은 Nodemailer를 사용한 이메일 발송 구현 예시입니다.
 * SendGrid, AWS SES 등 다른 서비스를 사용하는 경우 이 로직을 참고하여 구현하세요.
 */

import nodemailer from 'nodemailer';

/**
 * SMTP 트랜스포터 생성
 * 환경 변수에서 SMTP 설정을 가져옵니다.
 */
const transporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * 비밀번호 재설정 이메일 HTML 템플릿
 */
function getPasswordResetEmailTemplate(resetLink: string, serviceName: string = '서비스명'): string {
  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>비밀번호 재설정</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .container {
      background-color: #f9f9f9;
      border-radius: 8px;
      padding: 32px;
    }
    .header {
      text-align: center;
      margin-bottom: 32px;
    }
    .header h1 {
      color: #1a1a1a;
      font-size: 24px;
      margin: 0;
    }
    .content {
      background-color: white;
      border-radius: 8px;
      padding: 24px;
      margin-bottom: 24px;
    }
    .button {
      display: inline-block;
      background-color: #3B82F6;
      color: white;
      text-decoration: none;
      padding: 12px 32px;
      border-radius: 8px;
      font-weight: 600;
      margin: 16px 0;
    }
    .footer {
      text-align: center;
      font-size: 14px;
      color: #666;
    }
    .warning {
      background-color: #FEF3C7;
      border-left: 4px solid #F59E0B;
      padding: 12px;
      margin: 16px 0;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>비밀번호 재설정</h1>
    </div>
    
    <div class="content">
      <p>안녕하세요,</p>
      
      <p>비밀번호 재설정 요청을 받았습니다. 아래 버튼을 클릭하여 새로운 비밀번호를 설정해주세요.</p>
      
      <div style="text-align: center;">
        <a href="${resetLink}" class="button">비밀번호 재설정하기</a>
      </div>
      
      <p>또는 아래 링크를 복사하여 브라우저에 붙여넣으세요:</p>
      <p style="word-break: break-all; background-color: #f5f5f5; padding: 12px; border-radius: 4px; font-size: 14px;">
        ${resetLink}
      </p>
      
      <div class="warning">
        <strong>⚠️ 주의사항</strong><br>
        이 링크는 <strong>1시간 동안만 유효</strong>하며, 한 번만 사용할 수 있습니다.<br>
        요청하지 않으셨다면 이 이메일을 무시하셔도 됩니다.
      </div>
    </div>
    
    <div class="footer">
      <p>이 이메일은 자동으로 발송되었습니다. 회신하지 마세요.</p>
      <p>&copy; 2025 ${serviceName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * 비밀번호 변경 알림 이메일 HTML 템플릿
 */
function getPasswordChangedEmailTemplate(changedAt: string, serviceName: string = '서비스명'): string {
  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>비밀번호 변경 알림</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .container {
      background-color: #f9f9f9;
      border-radius: 8px;
      padding: 32px;
    }
    .header {
      text-align: center;
      margin-bottom: 32px;
    }
    .header h1 {
      color: #1a1a1a;
      font-size: 24px;
      margin: 0;
    }
    .content {
      background-color: white;
      border-radius: 8px;
      padding: 24px;
      margin-bottom: 24px;
    }
    .info-box {
      background-color: #DBEAFE;
      border-left: 4px solid #3B82F6;
      padding: 12px;
      margin: 16px 0;
      font-size: 14px;
    }
    .warning {
      background-color: #FEE2E2;
      border-left: 4px solid #EF4444;
      padding: 12px;
      margin: 16px 0;
      font-size: 14px;
    }
    .footer {
      text-align: center;
      font-size: 14px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ 비밀번호 변경 완료</h1>
    </div>
    
    <div class="content">
      <p>안녕하세요,</p>
      
      <p>귀하의 계정 비밀번호가 성공적으로 변경되었습니다.</p>
      
      <div class="info-box">
        <strong>📅 변경 일시</strong><br>
        ${changedAt}
      </div>
      
      <div class="warning">
        <strong>🚨 본인이 변경하지 않으셨나요?</strong><br>
        본인이 요청하지 않은 변경이라면 즉시 고객센터로 문의해주세요.<br>
        계정이 해킹되었을 가능성이 있습니다.
      </div>
      
      <p>계정 보안을 위해 다음 사항을 권장합니다:</p>
      <ul>
        <li>정기적으로 비밀번호를 변경하세요</li>
        <li>다른 서비스와 동일한 비밀번호를 사용하지 마세요</li>
        <li>2단계 인증을 활성화하세요 (가능한 경우)</li>
      </ul>
    </div>
    
    <div class="footer">
      <p>이 이메일은 자동으로 발송되었습니다. 회신하지 마세요.</p>
      <p>&copy; 2025 ${serviceName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * 비밀번호 재설정 이메일 발송
 * 
 * @param email 수신자 이메일
 * @param resetLink 비밀번호 재설정 링크
 */
export async function sendPasswordResetEmail(email: string, resetLink: string): Promise<void> {
  const serviceName = process.env.SERVICE_NAME || '서비스명';
  
  const mailOptions = {
    from: `"${serviceName}" <noreply@example.com>`,
    to: email,
    subject: `[${serviceName}] 비밀번호 재설정 요청`,
    html: getPasswordResetEmailTemplate(resetLink, serviceName),
    text: `
안녕하세요,

비밀번호 재설정 요청을 받았습니다.

아래 링크를 클릭하여 새로운 비밀번호를 설정해주세요:
${resetLink}

이 링크는 1시간 동안만 유효하며, 한 번만 사용할 수 있습니다.
요청하지 않으셨다면 이 이메일을 무시하셔도 됩니다.

감사합니다.
${serviceName} 팀
    `,
  };
  
  await transporter.sendMail(mailOptions);
}

/**
 * 비밀번호 변경 알림 이메일 발송
 * 
 * @param email 수신자 이메일
 */
export async function sendPasswordChangedEmail(email: string): Promise<void> {
  const serviceName = process.env.SERVICE_NAME || '서비스명';
  const changedAt = new Date().toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  
  const mailOptions = {
    from: `"${serviceName}" <noreply@example.com>`,
    to: email,
    subject: `[${serviceName}] 비밀번호가 변경되었습니다`,
    html: getPasswordChangedEmailTemplate(changedAt, serviceName),
    text: `
안녕하세요,

귀하의 계정 비밀번호가 성공적으로 변경되었습니다.

변경 일시: ${changedAt}

본인이 요청하지 않은 변경이라면 즉시 고객센터로 문의해주세요.
계정이 해킹되었을 가능성이 있습니다.

계정 보안을 위해 다음 사항을 권장합니다:
- 정기적으로 비밀번호를 변경하세요
- 다른 서비스와 동일한 비밀번호를 사용하지 마세요
- 2단계 인증을 활성화하세요 (가능한 경우)

감사합니다.
${serviceName} 팀
    `,
  };
  
  await transporter.sendMail(mailOptions);
}

/**
 * SendGrid를 사용하는 경우의 구현 예시
 */
/*
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

export async function sendPasswordResetEmail(email: string, resetLink: string): Promise<void> {
  const serviceName = process.env.SERVICE_NAME || '서비스명';
  
  const msg = {
    to: email,
    from: 'noreply@example.com',
    subject: `[${serviceName}] 비밀번호 재설정 요청`,
    html: getPasswordResetEmailTemplate(resetLink, serviceName),
  };
  
  await sgMail.send(msg);
}
*/

/**
 * AWS SES를 사용하는 경우의 구현 예시
 */
/*
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const sesClient = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });

export async function sendPasswordResetEmail(email: string, resetLink: string): Promise<void> {
  const serviceName = process.env.SERVICE_NAME || '서비스명';
  
  const command = new SendEmailCommand({
    Source: 'noreply@example.com',
    Destination: {
      ToAddresses: [email],
    },
    Message: {
      Subject: {
        Data: `[${serviceName}] 비밀번호 재설정 요청`,
      },
      Body: {
        Html: {
          Data: getPasswordResetEmailTemplate(resetLink, serviceName),
        },
      },
    },
  });
  
  await sesClient.send(command);
}
*/
