const { createClient } = require('@supabase/supabase-js');
const config = require('./config');

const supabase = createClient(config.supabaseUrl || 'http://localhost', config.supabaseKey || 'missing', {
  auth: { persistSession: false, autoRefreshToken: false },
});

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic' };

/**
 * อัปโหลดรูปขึ้น Supabase Storage แล้วคืน public URL
 * @param {{buffer:Buffer, mimetype:string}} file  ไฟล์จาก multer
 * @param {string} pathNoExt  path ไม่ต้องใส่นามสกุล
 */
async function uploadImage(file, pathNoExt) {
  if (!file || !file.buffer) return null;
  if (!/^image\//.test(file.mimetype)) throw new Error('ไฟล์ต้องเป็นรูปภาพเท่านั้น');
  const ext = EXT[file.mimetype] || 'jpg';
  const path = `${pathNoExt}.${ext}`;

  const { error } = await supabase.storage
    .from(config.bucket)
    .upload(path, file.buffer, { contentType: file.mimetype, upsert: true, cacheControl: '31536000' });
  if (error) throw new Error(`อัปโหลดรูปไม่สำเร็จ: ${error.message}`);

  const { data } = supabase.storage.from(config.bucket).getPublicUrl(path);
  return data.publicUrl;
}

module.exports = { supabase, uploadImage };
