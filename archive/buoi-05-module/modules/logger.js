// ===================================================================
// modules/logger.js - ví dụ về DEFAULT EXPORT
// Mỗi module có TỐI ĐA MỘT default export, nhưng vẫn được phép có thêm
// bao nhiêu named export tùy thích.
// ===================================================================

// PRIVATE: không export -> bên ngoài không thấy, không đổi được
const MUC_DO = {
    info: "INFO",
    warn: "WARN",
    error: "ERROR"
};

// DEFAULT EXPORT: nơi nhập được đặt tên tùy ý khi import
export default class Logger {
    constructor(prefix) {
        this.prefix = prefix;
    }

    ghi(mucDo, msg) {
        console.log(`  [${MUC_DO[mucDo]}] (${this.prefix}) ${msg}`);
        return this; // trả về this để nối chuỗi được
    }

    info(msg) {
        return this.ghi("info", msg);
    }

    error(msg) {
        return this.ghi("error", msg);
    }
}

// NAMED EXPORT đi kèm - hoàn toàn hợp lệ, không xung đột với default
export const VERSION = "1.0.0";

export function taoLogger(prefix) {
    return new Logger(prefix);
}
