do $verify$
declare
  matrix_count integer;
  session_count integer;
begin
  select count(*) into matrix_count
  from public.committee_matrix_seats seats
  join public."Committee" committee on committee."committeeID" = seats.committee_id
  where upper(committee."committeeCode") in ('GA1', 'UNHRC', 'UNODC', 'ECOSOC', 'UNSC', 'ICRCC');

  if matrix_count <> 101 then
    raise exception 'Expected 101 VOFMUN matrix seats, found %', matrix_count;
  end if;

  if exists (
    select 1
    from (
      select upper(committee."committeeCode") as code, count(*) as seats
      from public.committee_matrix_seats matrix
      join public."Committee" committee on committee."committeeID" = matrix.committee_id
      group by upper(committee."committeeCode")
    ) counts
    join (values
      ('GA1', 22),
      ('UNHRC', 15),
      ('UNODC', 13),
      ('ECOSOC', 18),
      ('UNSC', 15),
      ('ICRCC', 18)
    ) expected(code, seats) using (code)
    where counts.seats <> expected.seats
  ) then
    raise exception 'One or more VOFMUN committee matrices has an unexpected seat count';
  end if;

  select count(*) into session_count
  from public.chair_committee_sessions session
  join public."Committee" committee on committee."committeeID" = session.committee_id
  where session.session_number = 1
    and upper(committee."committeeCode") in ('GA1', 'UNHRC', 'UNODC', 'ECOSOC', 'UNSC', 'ICRCC');

  if session_count <> 6 then
    raise exception 'Expected six seeded chair sessions, found %', session_count;
  end if;
end
$verify$;

