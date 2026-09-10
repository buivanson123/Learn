// ============================================================
// Ví dụ 3: Quản lý trạng thái riêng tư (private state) dùng closure
//
// MÔ TẢ:
// `balance` không được expose ra ngoài trực tiếp — nó chỉ có thể
// bị thay đổi thông qua các phương thức deposit/withdraw được
// cung cấp. Đây là cách giả lập "private field" trước khi
// JavaScript có cú pháp #field chính thức (ES2022).
//
// KHI NÀO ÁP DỤNG:
// - Xây dựng module hoặc object cần bảo vệ dữ liệu nội bộ
//   (encapsulation), ngăn code bên ngoài sửa trực tiếp state.
// - Viết thư viện/API mà bạn muốn kiểm soát chặt cách dữ liệu
//   được thay đổi (validate trước khi update, như kiểm tra số dư).
// ============================================================

function createBankAccount(initialBalance) {
  let balance = initialBalance;

  return {
    deposit(amount) {
      balance += amount;
      return balance;
    },
    withdraw(amount) {
      if (amount > balance) {
        console.log("Số dư không đủ!");
        return balance;
      }
      balance -= amount;
      return balance;
    },
    getBalance() {
      return balance;
    },
  };
}

const account = createBankAccount(100);
console.log(account.deposit(50));   // 150
console.log(account.withdraw(30));  // 120
console.log(account.getBalance());  // 120
// `balance` không thể bị sửa trực tiếp từ bên ngoài, chỉ thông qua các phương thức được cung cấp.
