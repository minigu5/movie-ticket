import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { supabase } from '@/lib/supabase';
import { USER_EMAILS } from '@/lib/emails';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const { studentId, studentName, baseUrl, returnUrl } = await req.json();

    const userEmail = studentId === "교직원" ? USER_EMAILS[studentName] : USER_EMAILS[studentId];
    if (!userEmail) return NextResponse.json({ success: false, error: '등록된 이메일이 없습니다.' }, { status: 400 });

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    // 🌟 [수정됨] 교직원은 이름(studentName)을 ID 키값으로 업데이트
    const authKey = studentId === "교직원" ? studentName : studentId;

    const { error } = await supabase
      .from('student_auth')
      .update({ reset_token: resetToken, token_expires_at: expiresAt })
      .eq('student_id', authKey);

    if (error) throw error;

    // 4. 이메일 발송
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });

    const resetLink = `${baseUrl}/reset-password?token=${resetToken}&id=${encodeURIComponent(authKey)}${returnUrl ? `&returnUrl=${encodeURIComponent(returnUrl)}` : ''}`;
    
    const htmlContent = `
      <div style="padding: 30px; background-color: #f8fafc; font-family: sans-serif; text-align: center;">
        <div style="max-width: 400px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #1e293b;">🔒 비밀번호 재설정</h2>
          <p style="color: #475569; line-height: 1.6; margin-bottom: 20px;">
            ${studentName}님, 영화대교 예매 시스템 비밀번호 재설정 링크입니다.<br/>
            본인이 요청하지 않았다면 이 메일을 무시해 주세요. (30분간 유효)
          </p>
          <a href="${resetLink}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">비밀번호 재설정하기</a>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"영화대교 예매시스템" <${process.env.GMAIL_USER}>`,
      to: userEmail,
      subject: `[영화대교] ${studentName}님, 비밀번호 재설정 안내`,
      html: htmlContent
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}