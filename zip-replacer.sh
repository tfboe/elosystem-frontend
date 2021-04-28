#!/bin/bash
old=$1
new=$2

for fname in *.fast
do
  echo $fname;
  zipgrep -q $old "$fname";    
  if [ $? -eq 0 ]; then
     filename="outfrom.xml" 
     unzip -qp "$fname" "$filename" | sed -e 's#'$old'#'$new'#g' > "$filename"
     zip "$fname" "$filename"
  fi
done
