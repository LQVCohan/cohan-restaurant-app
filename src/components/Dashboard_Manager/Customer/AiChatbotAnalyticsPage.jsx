import React, { useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import useManagerRestaurantSelection from "@/hooks/useManagerRestaurantSelection";
import "./CustomerAnalyticsPage.scss";
import "./AiChatbotAdmin.scss";
import "./AiChatbotAdminFinalPolish.scss";

const GET_AI_CHATBOT_ANALYT