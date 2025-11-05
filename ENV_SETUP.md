# 🔧 Environment Variables Setup Guide

## 📋 ไฟล์ `.env` ที่ต้องสร้าง

สร้างไฟล์ `.env` ใน root directory ของ backend project (ที่เดียวกับ `package.json`)

## ✅ ตัวอย่างไฟล์ `.env`

```env
# Google OAuth Configuration
# ⚠️ สำคัญ: ต้องตั้งค่า GOOGLE_REDIRECT_URI ให้ตรงกับที่ตั้งค่าใน Google Cloud Console เป๊ะ
# ไม่มี trailing slash (/)
# ใช้ http ไม่ใช่ https สำหรับ localhost

GOOGLE_CLIENT_ID=955151956497-9otafel35l5k6c67peqitkl5acboq2qg.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:5173/auth/google/callback

# JWT Secret for token generation
JWT_SECRET=your_jwt_secret_here

# Database Configuration
DATABASE_URL="file:./prisma/dev.db"

# Server Configuration
PORT=5174
CORS_ORIGIN=http://localhost:5173
```

## ⚠️ ข้อควรระวัง

1. **GOOGLE_REDIRECT_URI** ต้องตรงกับที่ตั้งค่าใน Google Cloud Console **เป๊ะ**

   - ใช้ `http://localhost:5173/auth/google/callback` (ไม่ใช่ `http://localhost:3000`)
   - ไม่มี trailing slash `/`
   - ใช้ `http` ไม่ใช่ `https` สำหรับ localhost

2. **GOOGLE_CLIENT_SECRET** ต้องได้จาก Google Cloud Console

   - ไปที่ Google Cloud Console > APIs & Services > Credentials
   - เลือก OAuth 2.0 Client ID
   - Copy Client Secret

3. **JWT_SECRET** ควรเป็น random string ที่ปลอดภัย
   - สามารถใช้คำสั่ง `openssl rand -base64 32` เพื่อ generate

## 🔍 ตรวจสอบว่า Environment Variables ถูกโหลด

เมื่อรัน backend server จะเห็น log แสดงสถานะของ environment variables:

```
[Backend] Google OAuth Config: {
  CLIENT_ID: '✓ Set',
  CLIENT_SECRET: '✓ Set',
  REDIRECT_URI: 'http://localhost:5173/auth/google/callback',
  JWT_SECRET: '✓ Set'
}
[Backend] GOOGLE_REDIRECT_URI: http://localhost:5173/auth/google/callback
[Backend] API listening on http://localhost:5174
```

หากเห็น `✗ Missing` แสดงว่า environment variable นั้นยังไม่ได้ตั้งค่า

## 📝 หมายเหตุ

- ไฟล์ `.env` ไม่ควร commit ไปที่ git repository
- ตรวจสอบว่า `.env` อยู่ใน `.gitignore`
