--
-- PostgreSQL database dump
--

\restrict 1RKfycNpeXPAuYJGeU0UAD42RBIwoL8WK8yTZGlEggoznNAQN8Co3NwIs6xOxDV

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: canvas_objects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.canvas_objects (
    id character varying(255) NOT NULL,
    created_at timestamp(6) with time zone,
    payload_json text NOT NULL,
    room_id uuid NOT NULL,
    type character varying(255) NOT NULL
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id uuid NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    description text,
    name character varying(100) NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    created_by uuid NOT NULL,
    workspace_id uuid NOT NULL
);


--
-- Name: room_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.room_documents (
    id uuid NOT NULL,
    room_id uuid,
    title character varying(200) NOT NULL,
    content text,
    updated_by_name character varying(255),
    updated_at timestamp with time zone NOT NULL,
    author character varying(120),
    blocks_json text,
    description text,
    project_id uuid,
    workspace_id uuid NOT NULL
);


--
-- Name: room_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.room_files (
    id uuid NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    file_name character varying(255) NOT NULL,
    file_size bigint,
    file_type character varying(255),
    file_url character varying(255) NOT NULL,
    room_id uuid NOT NULL,
    uploaded_by_name character varying(255)
);


--
-- Name: room_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.room_messages (
    id uuid NOT NULL,
    attachment_url character varying(255),
    content text NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    room_id uuid NOT NULL,
    sender_id uuid,
    sender_name character varying(255) NOT NULL
);


--
-- Name: room_shapes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.room_shapes (
    id character varying(100) NOT NULL,
    room_id uuid NOT NULL,
    shape_data text NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: rooms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rooms (
    id uuid NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    description text,
    name character varying(150) NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    created_by uuid NOT NULL,
    project_id uuid NOT NULL,
    canvas_snapshot text,
    is_private boolean,
    created_by_id uuid
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    avatar_url character varying(255),
    created_at timestamp(6) with time zone NOT NULL,
    email character varying(100) NOT NULL,
    full_name character varying(100) NOT NULL,
    password_hash character varying(255) NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    username character varying(50) NOT NULL
);


--
-- Name: workspace_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_members (
    id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role character varying(255) DEFAULT 'EDITOR'::character varying NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: workspaces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspaces (
    id uuid NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    description text,
    name character varying(100) NOT NULL,
    slug character varying(100) NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    owner_id uuid NOT NULL
);


--
-- Name: canvas_objects canvas_objects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canvas_objects
    ADD CONSTRAINT canvas_objects_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: room_documents room_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_documents
    ADD CONSTRAINT room_documents_pkey PRIMARY KEY (id);


--
-- Name: room_files room_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_files
    ADD CONSTRAINT room_files_pkey PRIMARY KEY (id);


--
-- Name: room_messages room_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_messages
    ADD CONSTRAINT room_messages_pkey PRIMARY KEY (id);


--
-- Name: room_shapes room_shapes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_shapes
    ADD CONSTRAINT room_shapes_pkey PRIMARY KEY (id);


--
-- Name: rooms rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_pkey PRIMARY KEY (id);


--
-- Name: workspaces uk5n2kj8tecruebslxu9fm3k3t3; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT uk5n2kj8tecruebslxu9fm3k3t3 UNIQUE (slug);


--
-- Name: users uk6dotkott2kjsp8vw4d0m25fb7; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT uk6dotkott2kjsp8vw4d0m25fb7 UNIQUE (email);


--
-- Name: workspace_members uk6se2rw5firt04m4vpmqvbnr4u; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT uk6se2rw5firt04m4vpmqvbnr4u UNIQUE (workspace_id, user_id);


--
-- Name: users ukr43af9ap4edm43mmtq01oddj6; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT ukr43af9ap4edm43mmtq01oddj6 UNIQUE (username);


--
-- Name: workspace_members uq_workspace_user; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT uq_workspace_user UNIQUE (workspace_id, user_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: workspace_members workspace_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_pkey PRIMARY KEY (id);


--
-- Name: workspaces workspaces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_pkey PRIMARY KEY (id);


--
-- Name: idx_room_shapes_room_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_room_shapes_room_id ON public.room_shapes USING btree (room_id);


--
-- Name: rooms fk31elx4lfyydu29pa0jtnufge5; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT fk31elx4lfyydu29pa0jtnufge5 FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: workspaces fk58ks96jjlsbhsh21cen7hr59h; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT fk58ks96jjlsbhsh21cen7hr59h FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- Name: workspace_members fk6vtnpc3eexk504u61uepn40p1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT fk6vtnpc3eexk504u61uepn40p1 FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: rooms fk77who2slitjuivp456g9w192i; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT fk77who2slitjuivp456g9w192i FOREIGN KEY (created_by_id) REFERENCES public.users(id);


--
-- Name: projects fkf1ph00os6khfle3ub9b50x594; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT fkf1ph00os6khfle3ub9b50x594 FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: rooms fkoo674xs5ix0itmepevaj1j6ku; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT fkoo674xs5ix0itmepevaj1j6ku FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: projects fkpc7qv7bnsq7dm17g0tb0a60of; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT fkpc7qv7bnsq7dm17g0tb0a60of FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);


--
-- Name: workspace_members fkw9hq87n3rvq2c4j47qo78i5r; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT fkw9hq87n3rvq2c4j47qo78i5r FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);


--
-- PostgreSQL database dump complete
--

\unrestrict 1RKfycNpeXPAuYJGeU0UAD42RBIwoL8WK8yTZGlEggoznNAQN8Co3NwIs6xOxDV

