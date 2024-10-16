import pandas as pd

df = pd.read_csv('img_coordinates_final_v1_with_country.csv')
# dedup based on 'filename' column
df = df.drop_duplicates(subset='filename', keep='first')

json_output = df.to_json(orient='records', lines=False)

# save json file
with open('coordinates.json', 'w') as f:
    f.write(json_output)

f.close()