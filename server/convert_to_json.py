import pandas as pd

df = pd.read_csv('coordinates.csv')
json_output = df.to_json(orient='records', lines=False)

# save json file
with open('coordinates.json', 'w') as f:
    f.write(json_output)

f.close()