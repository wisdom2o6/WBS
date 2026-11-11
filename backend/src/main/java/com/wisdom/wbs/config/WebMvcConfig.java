package com.wisdom.wbs.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // Ánh xạ đường dẫn HTTP /uploads/** tới thư mục vật lý uploads/ trên hệ thống
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations("file:uploads/");
    }
}