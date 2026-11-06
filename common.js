// ฟังก์ชันที่ใช้ร่วมกันระหว่างหน้า LIFF และหน้าแอดมิน
window.Common = (() => {
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** ย่อรูปก่อนอัปโหลด (ยาวสุด maxSize px, JPEG) ลดขนาดเหลือ ~100-300KB */
  function compressImage(file, maxSize = 1280, quality = 0.75) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('แปลงรูปไม่สำเร็จ'))), 'image/jpeg', quality);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('ไม่สามารถอ่านไฟล์รูปนี้ได้ (ลองถ่ายใหม่หรือเลือกรูป JPG/PNG)'));
      };
      img.src = url;
    });
  }

  let toastTimer;
  function toast(msg, type = 'error') {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'fixed left-1/2 -translate-x-1/2 bottom-24 z-50 px-4 py-3 rounded-xl text-white text-sm shadow-lg max-w-[90%] text-center transition-opacity';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.background = type === 'error' ? '#E53935' : '#1F1F1F';
    el.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.style.opacity = '0'), 3000);
  }

  const avatar = (photo, name, size = 'w-16 h-16') =>
    photo
      ? `<img src="${esc(photo)}" alt="${esc(name)}" class="${size} rounded-full object-cover bg-gray-200" loading="lazy">`
      : `<div class="${size} rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-xl">${esc(
          (name || '?').trim().charAt(0)
        )}</div>`;

  return { esc, compressImage, toast, avatar };
})();
