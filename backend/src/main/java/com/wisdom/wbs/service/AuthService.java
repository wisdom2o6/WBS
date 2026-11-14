package com.wisdom.wbs.service;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.wisdom.wbs.dto.AuthResponse;
import com.wisdom.wbs.dto.LoginRequest;
import com.wisdom.wbs.dto.RegisterRequest;
import com.wisdom.wbs.entity.User;
import com.wisdom.wbs.repository.UserRepository;
import com.wisdom.wbs.security.JwtUtils;
import java.util.Collections;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor

public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtils jwtUtils;
    private final AuthenticationManager authenticationManager;

    @Value("${google.client-id}")
    private String googleClientId;

    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new IllegalArgumentException("Username is already taken");
        }
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Email is already registered");
        }

        User user = User.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName())
                .build();

        userRepository.save(user);

        String token = jwtUtils.generateToken(user.getId(), user.getUsername());
        return AuthResponse.builder()
                .accessToken(token)
                .userId(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .build();
    }

    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByUsername(request.getUsernameOrEmail())
                .orElseGet(() -> userRepository.findByEmail(request.getUsernameOrEmail())
                        .orElseThrow(() -> new IllegalArgumentException("Invalid username/email or password")));

        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(user.getUsername(), request.getPassword())
        );

        String token = jwtUtils.generateToken(user.getId(), user.getUsername());
        return AuthResponse.builder()
                .accessToken(token)
                .userId(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .build();
    }

    public AuthResponse loginWithGoogle(String idTokenString) {
        try {
            String cleanClientId = googleClientId != null ? googleClientId.trim() : "";
            GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(
                    new NetHttpTransport(), GsonFactory.getDefaultInstance())
                    .setAudience(Collections.singletonList(cleanClientId))
                    .build();

            GoogleIdToken idToken = verifier.verify(idTokenString);
            if (idToken == null) {
                GoogleIdToken unverified = GoogleIdToken.parse(GsonFactory.getDefaultInstance(), idTokenString);
                long nowSec = System.currentTimeMillis() / 1000L;
                throw new RuntimeException(
                        "Verify thất bại | BackendClientId=[" + cleanClientId + "]"
                        + " | TokenAud=[" + unverified.getPayload().getAudience() + "]"
                        + " | Exp=[" + unverified.getPayload().getExpirationTimeSeconds() + "]"
                        + " | Now=[" + nowSec + "]");
            }

            GoogleIdToken.Payload payload = idToken.getPayload();
            String email = payload.getEmail();
            String name = (String) payload.get("name");
            String pictureUrl = (String) payload.get("picture");

            User user = userRepository.findByEmail(email).orElseGet(() -> {
                String baseUsername = email.split("@")[0].replaceAll("[^a-zA-Z0-9._]", "");
                if (baseUsername.length() < 3) baseUsername = "user_" + baseUsername;
                if (baseUsername.length() > 40) baseUsername = baseUsername.substring(0, 40);

                String candidate = baseUsername;
                int suffix = 1;
                while (userRepository.existsByUsername(candidate)) {
                    candidate = baseUsername + suffix++;
                }

                User newUser = User.builder()
                        .email(email)
                        .username(candidate)
                        .fullName(name != null && !name.isBlank() ? name : candidate)
                        .passwordHash(passwordEncoder.encode(UUID.randomUUID().toString()))
                        .avatarUrl(pictureUrl)
                        .build();
                return userRepository.save(newUser);
            });

            // Cập nhật avatar nếu user chưa có
            if ((user.getAvatarUrl() == null || user.getAvatarUrl().isBlank()) && pictureUrl != null) {
                user.setAvatarUrl(pictureUrl);
                userRepository.save(user);
            }

            String token = jwtUtils.generateToken(user.getId(), user.getUsername());
            return AuthResponse.builder()
                    .accessToken(token)
                    .userId(user.getId())
                    .username(user.getUsername())
                    .email(user.getEmail())
                    .fullName(user.getFullName())
                    .build();
        } catch (Exception e) {
            throw new RuntimeException("Đăng nhập Google thất bại: " + e.getMessage(), e);
        }
    }
}