-- 074: 탭 스토어 — sales_count / revenue 증가 RPC
create or replace function public.increment_tap_sales(p_product_id uuid, p_revenue bigint)
returns void language sql security definer as $$
  update public.tap_products
  set sales_count = coalesce(sales_count, 0) + 1,
      revenue_total = coalesce(revenue_total, 0) + p_revenue,
      updated_at = now()
  where id = p_product_id;
$$;

grant execute on function public.increment_tap_sales(uuid, bigint) to authenticated, service_role;
