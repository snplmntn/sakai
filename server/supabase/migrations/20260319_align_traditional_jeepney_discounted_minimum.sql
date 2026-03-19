update public.fare_products
set minimum_fare_discounted = 13.00
where mode = 'jeepney'
  and product_code = 'puj_traditional';
