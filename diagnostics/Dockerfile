FROM php:8.3-apache

RUN docker-php-ext-install pdo_mysql \
 && a2enmod rewrite headers \
 && sed -ri 's!/var/www/html!/var/www/html/public!g' /etc/apache2/sites-available/*.conf /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf \
 && sed -ri 's/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf \
 && printf "upload_max_filesize=10M\npost_max_size=12M\nexpose_php=Off\n" > /usr/local/etc/php/conf.d/app.ini

COPY web/ /var/www/html/
RUN mkdir -p /var/www/html/storage/reports && chown -R www-data:www-data /var/www/html/storage

EXPOSE 80
