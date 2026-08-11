function request(type) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      type === "a"
        ? resolve(`resolve ${type}`)
        : reject(new Error(`reject ${type}`));
    }, 2000);
  });
}

async function getData() {
  const types = ["a", "b", "c"];

  // Chạy song song: 2s tổng, thay vì 6s như khi await lần lượt
  const results = await Promise.allSettled(types.map(request));
console.log("results::", results);
  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      console.log(`ret${i + 1}::`, result.value);
    } else {
      console.error(`Error ret${i + 1}::`, result.reason.message);
    }
  });

  // Trả về mảng giá trị, phần tử lỗi = null
  return results.map((r) => (r.status === "fulfilled" ? r.value : null));
}

getData();
