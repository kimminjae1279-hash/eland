-- 매출 데이터 테이블
CREATE TABLE IF NOT EXISTS sales_records (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_code      text NOT NULL,
  store_name      text NOT NULL,
  division        text NOT NULL DEFAULT '',
  brand           text NOT NULL DEFAULT '',
  channel         text DEFAULT '',
  sale_date       date NOT NULL,
  sales_amount    numeric NOT NULL DEFAULT 0,
  target_amount   numeric DEFAULT 0,
  margin_amount   numeric DEFAULT 0,
  ly_sales_amount numeric DEFAULT 0,
  uploaded_at     timestamptz DEFAULT now(),
  file_name       text,
  UNIQUE (store_code, sale_date, brand)
);

-- 업로드 이력 테이블
CREATE TABLE IF NOT EXISTS upload_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name   text NOT NULL,
  row_count   integer,
  uploaded_at timestamptz DEFAULT now(),
  status      text CHECK (status IN ('success', 'error')),
  error_msg   text
);

-- 인덱스 (필터 성능 최적화)
CREATE INDEX IF NOT EXISTS idx_sales_sale_date    ON sales_records (sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_store_code   ON sales_records (store_code);
CREATE INDEX IF NOT EXISTS idx_sales_brand        ON sales_records (brand);
CREATE INDEX IF NOT EXISTS idx_sales_division     ON sales_records (division);
CREATE INDEX IF NOT EXISTS idx_sales_channel      ON sales_records (channel);

-- RLS: 인증 없이 읽기/쓰기 허용 (내부 도구용, v1)
ALTER TABLE sales_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_logs   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_sales"  ON sales_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_logs"   ON upload_logs   FOR ALL USING (true) WITH CHECK (true);
