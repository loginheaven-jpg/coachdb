import psycopg2

conn = psycopg2.connect(
    host='junction.proxy.rlwy.net',
    port=57292,
    user='postgres',
    password='lFChOgaRykkLWYJLIJgkuhRlUQNEdluF',
    dbname='railway'
)
cur = conn.cursor()

# 1. CERT_COACH 관련 item_code 확인
print('=== CompetencyItems (CERT 관련) ===')
cur.execute('''
    SELECT item_id, item_code, item_name
    FROM competency_items
    WHERE item_code LIKE '%CERT%'
    ORDER BY item_code
''')
for row in cur.fetchall():
    print(f'  item_id={row[0]}, item_code={row[1]}, name={row[2][:30] if row[2] else ""}')

# 2. 사용자의 CoachCompetency 확인 (user_id=58 기준)
print()
print('=== CoachCompetency (user_id=58) ===')
cur.execute('''
    SELECT cc.competency_id, cc.item_id, ci.item_code, cc.value
    FROM coach_competencies cc
    JOIN competency_items ci ON cc.item_id = ci.item_id
    WHERE cc.user_id = 58 AND ci.item_code LIKE '%CERT%'
    ORDER BY ci.item_code
''')
for row in cur.fetchall():
    value_preview = (row[3][:80] + '...') if row[3] and len(row[3]) > 80 else row[3]
    print(f'  comp_id={row[0]}, item_id={row[1]}, code={row[2]}, value={value_preview}')

# 3. ApplicationData 확인 (user_id=58의 지원서)
print()
print('=== ApplicationData (user_id=58) ===')
cur.execute('''
    SELECT ad.data_id, ad.item_id, ci.item_code, ad.submitted_value, ad.competency_id
    FROM application_data ad
    JOIN applications a ON ad.application_id = a.application_id
    JOIN competency_items ci ON ad.item_id = ci.item_id
    WHERE a.user_id = 58 AND ci.item_code LIKE '%CERT%'
    ORDER BY ci.item_code
''')
for row in cur.fetchall():
    value_preview = (row[3][:80] + '...') if row[3] and len(row[3]) > 80 else row[3]
    print(f'  data_id={row[0]}, item_id={row[1]}, code={row[2]}, value={value_preview}, comp_id={row[4]}')

cur.close()
conn.close()
