begin;

grant execute on function private.is_platform_admin() to authenticated;

commit;
