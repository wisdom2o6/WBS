
package com.wisdom.wbs.controller;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;

@Controller
public class WebSocketTestController {

    public record TestMessage(String message) {}

    @MessageMapping("/test")
    @SendTo("/topic/test")
    public TestMessage test(TestMessage request) {
        return new TestMessage(
            "Spring Boot đã nhận: " + request.message()
        );
    }
}
