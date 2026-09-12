# Log thay đổi

Mỗi commit trong repo này tự sinh một mục log. Mục đích: sau vài tháng vẫn trả lời được
"bài này sửa hôm nào, sửa cái gì, vì sao" mà không phải đào `git log`.

| File | Nội dung |
|---|---|
| [2026-08.md](./2026-08.md) | 2 commit — dựng repo, thêm linux + redis |
| [2026-09.md](./2026-09.md) | 4 commit — thêm css, mở rộng các bộ phỏng vấn |

Tháng mới tự sinh file mới theo mẫu `log/YYYY-MM.md`, không cần tạo tay.

---

## Một mục log gồm gì

```markdown
## 2026-09-09 18:14 — `83fee59` add css

28 file, +11104 / −0 dòng · SonBV · nhánh `master`

- `css/01-cascade-va-selector.md` +659 / −0
- `css/du-an/landing/anh-chup-desktop-sang.png` nhị phân
- … và 8 file nữa

<!-- 83fee59... -->
```

Dòng `<!-- … -->` là hash đầy đủ, dùng để chống ghi trùng — đừng xoá.
Danh sách file cắt ở 25 dòng; commit lớn hơn thì ghi "… và N file nữa".

Thứ tự trong file: **cũ trước, mới sau** — đọc từ dưới lên nếu muốn xem việc mới nhất.

---

## Cơ chế

Hook `.githooks/post-commit` gọi `.githooks/ghi-log.sh`, cả hai đều nằm trong repo nên
sửa được và theo được git (khác `.git/hooks/` — thư mục đó không bao giờ được commit).

Repo đang trỏ hook path vào đó:

```bash
$ git config core.hooksPath
.githooks
```

**Máy mới clone về phải chạy một lệnh này, nếu không hook không hoạt động:**

```bash
$ git config core.hooksPath .githooks
```

### Ba điều cần biết về cách nó chạy

**1. Mục log của commit N nằm trong commit N+1.**
Hook chạy *sau* khi commit đã đóng, nên không thể nhét file log vào chính commit đó. Sau mỗi
commit bạn sẽ thấy `log/` bị sửa:

```bash
$ git commit -m "sửa bài flexbox"
$ git status --short
 M log/2026-09.md          ← mục vừa ghi, sẽ đi cùng commit sau
```

Không sao cả — cứ `git add log && git commit` lần tới là nó theo cùng. Đây là đánh đổi có ý:
cách duy nhất để nhét log vào cùng commit là `--amend`, và amend thì mọi `git push` đã làm trước đó
sẽ bị từ chối.

**2. Commit chỉ sửa trong `log/` thì bị bỏ qua.**
Nếu không, mỗi lần commit file log lại sinh ra một mục log mới — không bao giờ dừng.

**3. `--amend` và rebase được xử lý.**
Khi mục cuối file trỏ tới một commit không còn trong lịch sử, hook cắt mục lạc đó rồi ghi mục mới.
Đã thử: commit rồi `--amend`, số mục vẫn đúng, không sinh bản trùng.

---

## Ghi tay khi cần

Hook chỉ biết *file nào đổi bao nhiêu dòng*. Nó không biết **vì sao**. Với thay đổi quan trọng —
sửa một khẳng định sai, bỏ một câu hỏi, đổi hướng một bộ — hãy tự thêm một dòng `Vì sao:` ngay dưới
mục tương ứng:

```markdown
## 2026-09-13 21:05 — `abc1234` sua bang compat css

3 file, +64 / −31 dòng · SonBV · nhánh `master`

- `css/09-transition-va-animation.md` +24 / −18

Vì sao: `interpolate-size` chỉ chạy trên Chrome (đo bằng @mdn/browser-compat-data 8.1.1),
trước đó tài liệu dạy nó như cách làm mặc định — xem RA-SOAT-2026-09.md mục 2.
```

Hook không đụng tới những dòng bạn thêm vào; nó chỉ nối thêm vào cuối file.

---

## Tạm tắt

```bash
$ git config --unset core.hooksPath      # tắt hẳn
$ git commit --no-verify -m "..."        # KHÔNG tắt được hook này
```

`--no-verify` chỉ bỏ qua `pre-commit` và `commit-msg`, còn `post-commit` vẫn chạy. Muốn bỏ một lần
thì tạm đổi tên `.githooks/post-commit`.
