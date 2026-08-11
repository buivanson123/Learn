# Tự kiểm tra Docker

Với mỗi dòng: **"Tôi giải thích được trong 1 phút, kèm lệnh cụ thể hoặc con số từ dự án blog-api không?"**

✅ được · ⚠️ lơ mơ · ❌ không

Ngưỡng đi phỏng vấn backend: **không còn ❌ ở nhóm A và B**.

---

## A. Khái niệm — ai cũng bị hỏi

| | Nội dung | Bài gốc |
|---|---|---|
| ☐ | Image khác container | [00](../00-khai-niem.md) |
| ☐ | Container khác VM — dùng chung kernel | [00](../00-khai-niem.md) |
| ☐ | Layer là gì, chia sẻ giữa các image | [00](../00-khai-niem.md) |
| ☐ | `docker history` để tìm layer nặng | [05](../05-toi-uu.md) |
| ☐ | `.dockerignore` — vì sao **bắt buộc** có `.env` | [02](../02-dockerfile-nestjs.md) |
| ☐ | Dữ liệu mất khi nào (dừng vs xoá container) | [03](../03-compose-dev.md) |
| ☐ | `exec format error` — sai kiến trúc CPU | [08](../08-registry-ci-orchestration.md) |

---

## B. Dockerfile — nhóm ghi điểm

| | Nội dung | Bài gốc |
|---|---|---|
| ☐ | **Vì sao `COPY package.json` trước `COPY . .`** | [02](../02-dockerfile-nestjs.md) |
| ☐ | **`CMD` khác `ENTRYPOINT`** — cho ví dụ ghi đè | [02](../02-dockerfile-nestjs.md) |
| ☐ | Dạng exec vs dạng shell — liên quan tới `SIGTERM` | [02](../02-dockerfile-nestjs.md) |
| ☐ | Vì sao cần `dumb-init`/`tini` (vấn đề PID 1) | [02](../02-dockerfile-nestjs.md) |
| ☐ | Multi-stage build — **con số của bạn** trước/sau | [05](../05-toi-uu.md) |
| ☐ | `COPY` vs `ADD` — vì sao luôn dùng `COPY` | [02](../02-dockerfile-nestjs.md) |
| ☐ | `RUN` chạy lúc build, `CMD` chạy lúc start | [02](../02-dockerfile-nestjs.md) |
| ☐ | Gộp `RUN` — xoá ở layer sau **không** làm ảnh nhỏ đi | [05](../05-toi-uu.md) |
| ☐ | `ARG` vs `ENV` — **cả hai đều lộ secret** | [08 §3](../08-registry-ci-orchestration.md) |
| ☐ | `USER node` — kiểm tra bằng `docker exec whoami` | [05](../05-toi-uu.md) |

---

## C. Volume và mạng

| | Nội dung | Bài gốc |
|---|---|---|
| ☐ | Volume vs bind mount — dùng cái nào khi nào | [03](../03-compose-dev.md) |
| ☐ | Bẫy bind mount đè `node_modules` và cách sửa | [06](../06-loi-thuong-gap.md) |
| ☐ | Container gọi nhau bằng **tên service** | [03](../03-compose-dev.md) |
| ☐ | **`localhost` trong container trỏ vào chính nó** | [06](../06-loi-thuong-gap.md) |
| ☐ | `ports` vs `expose`; `127.0.0.1:5432:5432` an toàn hơn | [04](../04-compose-prod.md) |
| ☐ | `docker compose down -v` xoá volume | [03](../03-compose-dev.md) |
| ☐ | Sao lưu database bằng `pg_dump`, không chép file volume | [04](../04-compose-prod.md) |

---

## D. Compose và vận hành

| | Nội dung | Bài gốc |
|---|---|---|
| ☐ | **`depends_on` KHÔNG đợi service sẵn sàng** | [03](../03-compose-dev.md) |
| ☐ | Healthcheck + `condition: service_healthy` | [04](../04-compose-prod.md) |
| ☐ | Vì sao app vẫn nên tự retry kết nối | [03](../03-compose-dev.md) |
| ☐ | `up --build` — quên là chạy ảnh cũ | [06](../06-loi-thuong-gap.md) |
| ☐ | `docker system df` — thủ phạm thường là Build Cache | [08 §6](../08-registry-ci-orchestration.md) |
| ☐ | Vì sao **không** `system prune -a --volumes` theo phản xạ | [08 §6](../08-registry-ci-orchestration.md) |
| ☐ | Giới hạn log `max-size`/`max-file` | [08 §6](../08-registry-ci-orchestration.md) |
| ☐ | Debug container không khởi động — 4 lệnh theo thứ tự | [06](../06-loi-thuong-gap.md) |
| ☐ | Exit code 137 nghĩa là gì | [06](../06-loi-thuong-gap.md) |

---

## E. Production

| | Nội dung | Bài gốc |
|---|---|---|
| ☐ | Registry là gì, đặt tên ảnh đầy đủ gồm gì | [08 §1](../08-registry-ci-orchestration.md) |
| ☐ | **Vì sao không deploy bằng `latest`** — 3 lý do | [08 §1](../08-registry-ci-orchestration.md) |
| ☐ | Ghim ảnh nền bằng digest — đánh đổi là gì | [08 §1](../08-registry-ci-orchestration.md) |
| ☐ | Build trong CI + cache layer giữa các lần chạy | [08 §2](../08-registry-ci-orchestration.md) |
| ☐ | BuildKit `--mount=type=secret` | [08 §3](../08-registry-ci-orchestration.md) |
| ☐ | Quét CVE bằng `docker scout` / `trivy` | [08 §2](../08-registry-ci-orchestration.md) |
| ☐ | **Compose dùng production được không** — trả lời có điều kiện | [08 §4](../08-registry-ci-orchestration.md) |
| ☐ | **Liveness vs readiness probe** | [08 §4](../08-registry-ci-orchestration.md) |
| ☐ | Bảng đối chiếu Compose ↔ Kubernetes | [08 §4](../08-registry-ci-orchestration.md) |
| ☐ | Deploy không downtime bằng Compose — 3 thứ phải có | [08 §5](../08-registry-ci-orchestration.md) |
| ☐ | Migration tương thích ngược khi deploy | [08 §5](../08-registry-ci-orchestration.md) |

---

## F. Có con số không?

Docker là chủ đề mà con số thuyết phục hơn lý thuyết. Bạn có sẵn những số này chưa?

| | Con số |
|---|---|
| ☐ | Ảnh blog-api trước/sau multi-stage (___MB → ___MB) |
| ☐ | Thời gian build khi đúng/sai thứ tự `COPY` (___s → ___s) |
| ☐ | `docker system df` trên máy bạn — cái gì chiếm nhiều nhất |
| ☐ | Số CVE trước/sau khi đổi sang ảnh `-alpine` |

---

## G. Kể được không?

| | Nội dung |
|---|---|
| ☐ | Kể việc bạn đóng gói blog-api bằng Docker, kèm khó khăn gặp phải |
| ☐ | Một lỗi Docker khó: `localhost` trong container, hoặc `exec format error`, hoặc bind mount đè `node_modules` |
| ☐ | Vì sao bạn chọn Compose thay vì Kubernetes cho dự án đó |

---

## Chấm

| Kết quả | Nghĩa |
|---------|-------|
| A còn ❌ | Ôn lại [bài 00](../00-khai-niem.md) — đây là câu mở đầu ai cũng bị hỏi |
| B còn ❌ | **Ưu tiên cao nhất.** Nhóm này phân biệt "đọc tài liệu" và "tự viết Dockerfile" |
| C, D còn ⚠️ | Chấp nhận được nếu bạn từng gặp lỗi đó thật |
| E toàn ⚠️ | Không sao nếu bạn là backend (không phải DevOps) — nhưng biết thì rất nổi bật |
| F còn ❌ | **Đi đo ngay.** Không có con số thì câu trả lời nghe như đọc thuộc |

---

| Lần | Ngày | ❌ | ⚠️ |
|-----|------|----|----|
| 1 | | | |
| 2 | | | |

---

Quay lại [README phỏng vấn](./README.md) · [Bộ Docker](../README.md)
