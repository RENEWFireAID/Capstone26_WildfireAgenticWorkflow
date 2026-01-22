import requests
import re

# Retrieve raw html
url = "https://www.fs.usda.gov/nwacfire/home/terminology.html"
res = requests.get(url)

if res.status_code == 200:
    with open("terms.csv", "w") as f:
        # Get the block of html with terminology
        fmatch = re.search('<!-- InstanceBeginEditable name="content" -->', res.text)
        lmatch = list(re.finditer('<!-- InstanceEndEditable -->', res.text))[-1]

        # Split the text into chunks
        term_block = res.text[fmatch.end():lmatch.start()]
        terms_iter = term_block.split("</p>")

        
        term_csv = ""
        for item in terms_iter:
            # Throw away chunks that dont include a definition
            if re.match("\n.+<p><strong>", item) == None:
                continue

            tmatch = re.search("<p><strong>.+</strong>", item)
            if tmatch == None:
                print(f"FAILED TO GET TERM FROM {item}")
                continue
            term = item[tmatch.start() + 11:tmatch.end() - 9]

            # Becuase this website sometimes has the : inside the <strong> block we
            # have to handle removing that to automate this, I love inconsistency!
            if term[-1] == ":":
                term = term[:-1]

            # Apparently some terms also have an <a> tag inside the <strong> block
            # so this is removing those
            a_tag = re.search("<a.+></a>", term)
            if a_tag != None:
                term = term[:a_tag.start()] + term[a_tag.end():]

            dmatch = re.search("</strong>.+", item)
            if dmatch == None:
                print(f"FAILED TO GET DEF FROM {item}")
                continue
            definition = item[dmatch.start() + 10:].replace("\n", "").replace(",", "\,")

            # Remove excess spaces
            for i in range(len(definition) - 2):
                while True:
                    if definition[i] != " " or definition[i+1] != " ":
                        break
                    definition = definition[:i+1] + definition[i+2:]

                # May need to break out of loop early since we may reduce the
                # length of definition and the for loop will retain its original value
                if i >= len(definition) - 2:
                    break
                    
            # This is handeling the inconsistency added by that optional : at the start of the string
            if definition[0] == " ":
                definition = definition[1:]
            
            term_csv += f"{term},{definition}\n"

       
        f.write(term_csv)
        
else:
    print("Failed to get html, status: ", res.status_code)
