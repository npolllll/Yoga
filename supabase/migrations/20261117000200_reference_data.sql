-- Reference data required in every environment (editable later in the admin panel).

insert into public.levels (key, position, rank, label, description) values
  ('beginner', 1, 1, '{"ru":"Начальный","en":"Beginner"}',
   '{"ru":"Первые балансы и освоение опоры.","en":"First balances and building a solid base."}'),
  ('intermediate', 2, 2, '{"ru":"Средний","en":"Intermediate"}',
   '{"ru":"Развитие устойчивости и силы.","en":"Developing stability and strength."}'),
  ('advanced', 3, 3, '{"ru":"Продвинутый","en":"Advanced"}',
   '{"ru":"Сложные балансы и инверсии.","en":"Complex balances and inversions."}'),
  ('expert', 4, 4, '{"ru":"Эксперт","en":"Expert"}',
   '{"ru":"Одноручные балансы и сложные переходы.","en":"One-arm balances and advanced transitions."}');

insert into public.categories (key, position, name, description) values
  ('arm-balances', 1, '{"ru":"Балансы на руках","en":"Arm Balances"}',
   '{"ru":"Балансы с опорой на ладони и руки.","en":"Balances supported by the hands and arms."}'),
  ('side-balances', 2, '{"ru":"Боковые балансы","en":"Side Balances"}',
   '{"ru":"Боковая опора, скручивания и боковые вариации.","en":"Side support, twists and lateral variations."}'),
  ('shoulder-balances', 3, '{"ru":"Балансы с опорой на плечи","en":"Shoulder Balances"}',
   '{"ru":"Положения, где важную роль играет опора на плечевой пояс.","en":"Positions where the shoulder girdle carries the support."}'),
  ('handstands', 4, '{"ru":"Стойки на руках","en":"Handstands"}',
   '{"ru":"Стойки на прямых руках и их вариации.","en":"Straight-arm handstands and their variations."}'),
  ('forearm-balances', 5, '{"ru":"Стойки на предплечьях","en":"Forearm Balances"}',
   '{"ru":"Пинча и другие балансы на предплечьях.","en":"Pincha and other forearm balances."}'),
  ('one-arm-balances', 6, '{"ru":"Балансы на одной руке","en":"One-Arm Balances"}',
   '{"ru":"Одноручные балансы и стойки.","en":"One-arm balances and handstands."}'),
  ('transitions', 7, '{"ru":"Переходы и комбинации","en":"Transitions & Combos"}',
   '{"ru":"Динамические переходы между асанами и связки.","en":"Dynamic transitions between poses and sequences."}');

insert into public.skills (key, position, quick_filter, name) values
  ('arm-strength', 1, true, '{"ru":"Сила рук","en":"Arm Strength"}'),
  ('flexibility', 2, true, '{"ru":"Гибкость","en":"Flexibility"}'),
  ('shoulder-mobility', 3, true, '{"ru":"Мобильность плеч","en":"Shoulder Mobility"}'),
  ('hip-openness', 4, true, '{"ru":"Раскрытие тазобедренных суставов","en":"Hip Openness"}'),
  ('core-control', 5, true, '{"ru":"Контроль корпуса","en":"Core Control"}'),
  ('wrist-strength', 6, false, '{"ru":"Сила и подвижность запястий","en":"Wrist Strength"}'),
  ('balance-coordination', 7, false, '{"ru":"Координация и баланс","en":"Balance & Coordination"}'),
  ('inversion', 8, false, '{"ru":"Работа в перевёрнутом положении","en":"Inversion Control"}'),
  ('hamstring-flexibility', 9, false, '{"ru":"Гибкость задней поверхности бедра","en":"Hamstring Flexibility"}'),
  ('twist', 10, false, '{"ru":"Скручивание","en":"Twisting"}');

update public.site_settings set data = '{
  "levelLabelOverrides": {},
  "contact": {"email": null, "socials": []},
  "brand": {"name": "BALANCE", "tagline": {"ru": "Найди свою точку баланса.", "en": "Find your balance."}}
}'::jsonb where id = 1;
