-- Refresh derived previews for the same IFC without replacing document versions.
do $migration$
declare
    original text := pg_get_functiondef('public.cde_api(text,jsonb,text)'::regprocedure);
    old_clause text := 'on conflict on constraint models_pkey do update set owners=(select array_agg(distinct o) from unnest(cde_private.models.owners||excluded.owners) o);';
    new_clause text := $clause$
on conflict on constraint models_pkey do update set
    owners=(select array_agg(distinct o) from unnest(cde_private.models.owners||excluded.owners) o),
    metadata=case when cde_private.models.metadata->>'hash'=excluded.metadata->>'hash'
        and coalesce((excluded.metadata->>'previewVersion')::integer,0)>coalesce((cde_private.models.metadata->>'previewVersion')::integer,0)
        then cde_private.models.metadata || jsonb_build_object(
            'previewVersion',excluded.metadata->'previewVersion',
            'geometryAssets',excluded.metadata->'geometryAssets',
            'renderOrigin',excluded.metadata->'renderOrigin',
            'count',excluded.metadata->'count',
            'status',excluded.metadata->'status')
        else cde_private.models.metadata end,
    elements=case when cde_private.models.metadata->>'hash'=excluded.metadata->>'hash'
        and coalesce((excluded.metadata->>'previewVersion')::integer,0)>coalesce((cde_private.models.metadata->>'previewVersion')::integer,0)
        then excluded.elements else cde_private.models.elements end;
$clause$;
begin
    if position(old_clause in original)=0 then
        raise exception 'Expected model import conflict clause is missing';
    end if;
    execute replace(original,old_clause,new_clause);
end
$migration$;
