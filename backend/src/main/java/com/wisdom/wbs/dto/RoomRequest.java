package com.wisdom.wbs.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class RoomRequest {
    @NotBlank(message = "Room name is required")
    @Size(max = 100)
    private String name;

    private String description;
}