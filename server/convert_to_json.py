import pandas as pd

df = pd.read_csv('coordinates.csv')
# dedup based on 'filename' column
# df = df.drop_duplicates(subset='filename', keep='first')

# shuffle values
df = df.sample(frac=1).reset_index(drop=True)

json_output = df.to_json(orient='records', lines=False)

# save json file
with open('coordinates.json', 'w') as f:
    f.write(json_output)

f.close()
