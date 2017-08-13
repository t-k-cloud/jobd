F=$(php --ini | grep Loaded | awk -F: '{gsub(/ /, "", $0); print $2}')

echo "Patching PHP.ini file: $F"

###
# change open_basedir and display_errors
###
sed -i '/open_basedir.*=/c ;open_basedir =' $F
sed -i 's/display_errors = Off/display_errors = On/' $F

###
# enable necessary modules
###
sed -i 's/;extension=mysql\.so/extension=mysql\.so/' $F
sed -i 's/;extension=mysqli\.so/extension=mysqli\.so/' $F
sed -i 's/;extension=gd\.so/extension=gd\.so/' $F
sed -i 's/;extension=pdo_mysql\.so/extension=pdo_mysql\.so/' $F
