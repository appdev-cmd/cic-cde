# Hướng dẫn Deploy CDE CIC Self-Host trên Viettel Cloud

## Tổng quan hạ tầng

| Thành phần | Cấu hình |
|---|---|
| vServer CS3 | 4 vCPU, 8GB RAM, 80GB + 20GB SSD |
| Viettel Object Storage Gold | 500GB (S3-compatible) |
| Viettel Cloud Backup | 1 license, 120GB (1 full + 2 incremental) |
| Domain + SSL | Let's Encrypt hoặc CA nội bộ |

## Kiến trúc Docker (9 containers)

```
Internet → Nginx (443) → Kong API Gateway (8000)
                            ├── Auth (GoTrue)    → PostgreSQL
                            ├── REST (PostgREST)  → PostgreSQL
                            ├── Realtime          → PostgreSQL
                            └── Storage API       → Viettel Object Storage
                       → CDE API (Node.js, 3001)
                       → Frontend SPA (React + BIM Viewer)
```

## Quick Deploy (3 bước)

### Bước 1: Setup VM (chạy 1 lần)

```bash
ssh root@<VM_IP>

# Upload scripts
scp -r selfhost/ root@<VM_IP>:/opt/cde/

# Trên VM
cd /opt/cde/selfhost
bash scripts/setup-vm.sh
```

### Bước 2: Cấu hình

```bash
cd /opt/cde/selfhost

# Generate keys
bash scripts/generate-keys.sh
# Copy output vào notepad

# Generate API keys (ANON_KEY, SERVICE_ROLE_KEY)
node scripts/generate-jwt-keys.js "<JWT_SECRET_from_above>"

# Tạo .env
cp .env.example .env
nano .env
# Điền TẤT CẢ giá trị thật
```

**Thông tin cần từ Viettel:**
- IP vServer (SSH)
- Object Storage: Endpoint URL, Access Key, Secret Key
- Thông tin backup policy

**Thông tin cần tự chuẩn bị:**
- Domain name (vd: cde.cic.com.vn)
- SMTP server (host, port, user, pass)
- Gemini API Key (cho BIM AI Assistant)

### Bước 3: Deploy

```bash
# Build frontend (trên máy dev hoặc trên VM)
cd /opt/cde
npm install && npm run build
cp -r dist/ selfhost/dist/

# Deploy stack
cd /opt/cde/selfhost
bash scripts/deploy.sh
```

## Migrate Data từ Supabase Cloud

```bash
bash scripts/migrate-from-cloud.sh
```

Script sẽ:
1. Dump database từ Supabase Cloud
2. Restore vào PostgreSQL local
3. Sync storage files qua rclone sang Viettel Object Storage

## Apply migrations từ supabase/migrations/

```bash
bash scripts/apply-migration.sh
```

## Quản lý hàng ngày

### Kiểm tra sức khỏe
```bash
bash scripts/health-check.sh
```

### Xem logs
```bash
docker compose logs -f          # Tất cả
docker compose logs -f auth     # Auth service
docker compose logs -f api      # CDE API
docker compose logs -f db       # Database
```

### Cập nhật frontend (không downtime)
```bash
bash scripts/update-frontend.sh /path/to/new/dist
```

### Cập nhật API
```bash
docker compose build api
docker compose up -d api
```

### Vào database
```bash
docker exec -it supabase-db psql -U postgres
```

## Backup

### Tự động (cron)
- **Hàng ngày 09:00** (GMT+7): backup DB
- **Chủ nhật**: full dump (pg_dumpall)
- **Thứ 2-7**: daily dump (pg_dump)
- **Retention**: 14 ngày local, 30 ngày off-site (Viettel S3)

### Thủ công
```bash
bash scripts/backup-db.sh
```

### Restore từ backup
```bash
gunzip -c /opt/cde/backups/full_YYYYMMDD_HHMMSS.sql.gz | \
  docker exec -i supabase-db psql -U postgres
```

## SSL Certificate

### Let's Encrypt (khuyến nghị)
```bash
certbot certonly --standalone -d cde.cic.com.vn
cp /etc/letsencrypt/live/cde.cic.com.vn/fullchain.pem nginx/ssl/server.crt
cp /etc/letsencrypt/live/cde.cic.com.vn/privkey.pem nginx/ssl/server.key
docker exec supabase-nginx nginx -s reload
```

### Renew tự động
```bash
# Thêm vào crontab
0 3 1 * * certbot renew --deploy-hook "cp /etc/letsencrypt/live/cde.cic.com.vn/fullchain.pem /opt/cde/selfhost/nginx/ssl/server.crt && cp /etc/letsencrypt/live/cde.cic.com.vn/privkey.pem /opt/cde/selfhost/nginx/ssl/server.key && docker exec supabase-nginx nginx -s reload"
```

## Supabase Studio (quản trị DB)

Chỉ chạy ở production, truy cập qua SSH tunnel:

```bash
# Từ máy dev
ssh -L 3010:localhost:3010 root@<VM_IP>
# Mở browser: http://localhost:3010

# Deploy với Studio
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Cấu trúc thư mục trên VM

```
/opt/cde/
├── dist/                        # Frontend build output
├── selfhost/
│   ├── docker-compose.yml       # Stack definition
│   ├── docker-compose.prod.yml  # Production overrides (ClamAV, Studio)
│   ├── .env                     # Secrets (KHÔNG commit)
│   ├── dist/                    # Frontend (symlink or copy)
│   ├── nginx/
│   │   ├── nginx.conf
│   │   └── ssl/
│   │       ├── server.crt
│   │       └── server.key
│   ├── api/                     # Node.js API
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── src/
│   ├── volumes/
│   │   ├── kong/kong.yml
│   │   └── db/99-roles.sh
│   └── scripts/
│       ├── setup-vm.sh
│       ├── deploy.sh
│       ├── backup-db.sh
│       ├── health-check.sh
│       ├── update-frontend.sh
│       ├── migrate-from-cloud.sh
│       ├── apply-migration.sh
│       ├── generate-keys.sh
│       └── generate-jwt-keys.js
└── backups/                     # DB backup files
```

## Troubleshooting

| Vấn đề | Giải pháp |
|---|---|
| Container restart loop | `docker compose logs <service>` kiểm tra lỗi |
| Auth 500 | Kiểm tra GOTRUE_DB_DATABASE_URL trong .env |
| Storage upload fail | Kiểm tra Viettel S3 credentials + endpoint |
| Kong bad gateway | `docker compose restart kong` sau khi auth/rest healthy |
| Out of memory | `docker stats` xem container nào chiếm nhiều RAM |
| DB connection refused | `docker compose restart db` + đợi healthcheck |
| WASM not loading | Kiểm tra nginx config cho `.wasm` MIME type |
| IFC file upload timeout | Tăng `client_max_body_size` trong nginx.conf |
