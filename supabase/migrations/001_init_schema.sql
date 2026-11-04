-- =============================================================================
-- TaskFlow — Supabase Database Schema & Row Level Security (Phase 3)
-- Chạy script này trong mục SQL Editor trên Supabase Dashboard của bạn
-- =============================================================================

-- 1. Bảng lưu trữ Công việc (public.tasks)
CREATE TABLE IF NOT EXISTS public.tasks (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (char_length(trim(title)) > 0 AND char_length(title) <= 120),
    description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 500),
    due_date DATE NOT NULL,
    due_time TEXT NOT NULL DEFAULT '23:59' CHECK (due_time ~ '^\d{2}:\d{2}$'),
    due_at TIMESTAMPTZ NOT NULL,
    remind_offset_minutes INTEGER NOT NULL DEFAULT -1,
    remind_at TIMESTAMPTZ NULL,
    reminder_sent BOOLEAN NOT NULL DEFAULT FALSE,
    reminder_sent_at TIMESTAMPTZ NULL,
    priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High')),
    status TEXT NOT NULL DEFAULT 'Todo' CHECK (status IN ('Todo', 'In Progress', 'Completed')),
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

-- Index tối ưu hóa truy vấn theo người dùng và quét lịch nhắc nhở
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_pending_reminders
    ON public.tasks(remind_at)
    WHERE status <> 'Completed' AND reminder_sent = FALSE AND remind_at IS NOT NULL;

-- 2. Bảng lưu trữ Push Subscription của từng thiết bị (chuẩn bị sẵn cho Giai đoạn 4)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user_id
    ON public.push_subscriptions(user_id)
    WHERE is_active = TRUE;

-- 3. BẬT ROW LEVEL SECURITY (BẮT BUỘC ĐỂ BẢO MẬT DỮ LIỆU CÁ NHÂN)
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Xóa policy cũ nếu chạy lại migration
DROP POLICY IF EXISTS "Users can view own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can insert own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete own tasks" ON public.tasks;

-- Chính sách RLS cho bảng public.tasks: Mỗi tài khoản chỉ truy cập được công việc của chính mình
CREATE POLICY "Users can view own tasks"
    ON public.tasks FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tasks"
    ON public.tasks FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks"
    ON public.tasks FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tasks"
    ON public.tasks FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Chính sách RLS cho bảng public.push_subscriptions
DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can insert own subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can delete own subscriptions" ON public.push_subscriptions;

CREATE POLICY "Users can view own subscriptions"
    ON public.push_subscriptions FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions"
    ON public.push_subscriptions FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions"
    ON public.push_subscriptions FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own subscriptions"
    ON public.push_subscriptions FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);
