-- reservations 테이블에 UPDATE RLS 정책이 없어서 클라이언트에서 좌석 이동/팝콘 추가 시
-- UPDATE가 항상 0행 적용(조용히 실패)되던 문제 수정.
create policy "reservations_update_own"
on public.reservations
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
