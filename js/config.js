/**
 * TaskFlow — Cấu hình kết nối công khai (Phase 3: Supabase Cloud Sync)
 *
 * LƯU Ý BẢO MẬT QUAN TRỌNG:
 * - Chỉ điền SUPABASE_URL và SUPABASE_ANON_KEY (Public Anon Key).
 * - TUYỆT ĐỐI KHÔNG điền service_role key hoặc VAPID private key vào file này.
 * - Dữ liệu trên Supabase được bảo vệ bởi Row Level Security (RLS) theo từng tài khoản.
 * - Bạn có thể điền trực tiếp vào bên dưới hoặc nhập ngay trên giao diện "Đồng bộ" của ứng dụng.
 */

window.TASKFLOW_CONFIG = {
    SUPABASE_URL: '',
    SUPABASE_ANON_KEY: '',
    VAPID_PUBLIC_KEY: ''
};

