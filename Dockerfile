# ใช้ Node.js official image
FROM node:20-alpine

# ตั้ง working directory
WORKDIR /app

# คัดลอก package.json และ package-lock.json ก่อนเพื่อลดเวลา rebuild
COPY package*.json ./

# ติดตั้ง dependencies
RUN npm install

# คัดลอกไฟล์โปรเจคทั้งหมด
COPY . .

# รัน Prisma generate (ถ้าใช้ Prisma)
RUN npx prisma generate

# build ถ้ามี (เช่น TypeScript project)
RUN npm run build

# expose port ที่ backend ใช้
EXPOSE 5174

# คำสั่งรัน backend
CMD ["npm", "run", "start"]
