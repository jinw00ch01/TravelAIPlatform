import React, { useState, useCallback } from 'react';
import {
  Fab, Box, Paper, Typography, IconButton, TextField, Button, Divider, useTheme, Slide
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';

const AIChatWidget = ({ onSendMessage }) => {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');

  const toggleChat = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const handleCloseChat = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleSend = useCallback(() => {
    if (message.trim()) {
      if (onSendMessage) {
        onSendMessage(message.trim());
      }
      setMessage('');
      // 메시지 전송 후 채팅창을 닫을지 여부는 정책에 따라 결정
      // setIsOpen(false); 
    }
  }, [message, onSendMessage]);

  return (
    <Box sx={{ position: 'fixed', bottom: 32, right: 32, zIndex: 1050 }}>
      {/* Chat Window */}
      <Slide direction="up" in={isOpen} mountOnEnter unmountOnExit>
        <Paper
          elevation={8}
          sx={{
            width: 360,
            height: 500,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: '12px',
            overflow: 'hidden',
            backgroundColor: theme.palette.background.paper,
            mb: theme.spacing(10), // Fab 높이(8) + 추가 간격(2)
          }}
        >
          {/* Header */}
          <Box
            sx={{
              p: 1.5,
              backgroundColor: theme.palette.primary.main,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTopLeftRadius: '12px',
              borderTopRightRadius: '12px',
            }}
          >
            <Typography variant="subtitle1" sx={{ color: 'white', fontWeight: 'bold' }}>
              AI 여행 비서 ✧
            </Typography>
            <IconButton onClick={handleCloseChat} size="small">
              <CloseIcon sx={{ color: 'white' }} />
            </IconButton>
          </Box>

          {/* Message Area (Placeholder) */}
          <Box
            sx={{
              flexGrow: 1,
              p: 2,
              overflowY: 'auto',
            }}
          >
            <Typography variant="body2" color="textSecondary">
              AI에게 여행 계획 변경을 요청해보세요. (예: "내일 일정을 좀 더 여유롭게 바꿔줘")
            </Typography>
            {/* 채팅 메시지 목록이 여기에 표시됩니다 */}
          </Box>

          <Divider />

          {/* Input Area */}
          <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', backgroundColor: theme.palette.background.default }}>
            <TextField
              fullWidth
              variant="outlined"
              size="small"
              placeholder="메시지를 입력하세요..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              sx={{ mr: 1 }}
            />
            <Button
              variant="contained"
              onClick={handleSend}
              disabled={!message.trim()}
              sx={{
                backgroundColor: theme.palette.primary.main,
                minWidth: 'auto',
                padding: '8px',
                '&:hover': {
                  backgroundColor: theme.palette.primary.dark,
                }
              }}
            >
              <SendIcon />
            </Button>
          </Box>
        </Paper>
      </Slide>

      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="toggle-ai-chat"
        onClick={toggleChat} // 버튼 클릭 시 채팅창 토글
        sx={{
          position: 'absolute', // 채팅창과 독립적인 위치 고정
          bottom: 0, // Box의 bottom: 32, right: 32 기준으로 위치
          right: 0,  // Box의 bottom: 32, right: 32 기준으로 위치
          boxShadow: theme.shadows[6],
          '&:hover': {
            backgroundColor: theme.palette.primary.dark,
          },
          width: '64px',
          height: '64px',
        }}
      >
        <Box sx={{ 
          position: 'relative', 
          width: '100%', 
          height: '100%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center' 
        }}>
          {/* Big Star (Center) - 정확히 중앙 정렬 */}
          <Typography sx={{ 
            fontSize: '32px',
            color: 'white', 
            lineHeight: '1',
            position: 'absolute',
            transform: 'scaleY(1.2)',
            top: '50%', 
            left: '50%',
            marginTop: '-16px', // 폰트 크기의 절반
            marginLeft: '-16px', // 폰트 크기의 절반
          }}>
            ✧
          </Typography>
          {/* Small Star (Left-Top Diagonal) */}
          <Typography sx={{ 
            fontSize: '16px', 
            color: 'white', 
            lineHeight: '1',
            position: 'absolute',
            top: '13px', 
            left: '12px',
            transform: 'rotate(-15deg)',
          }}>
            ✧
          </Typography>
          {/* Small Star (Bottom-Right Diagonal) */}
          <Typography sx={{ 
            fontSize: '14px', 
            color: 'white', 
            lineHeight: '1',
            position: 'absolute',
            bottom: '13px', 
            right: '12px',
            transform: 'rotate(20deg)',
          }}>
            ✧
          </Typography>
        </Box>
      </Fab>
    </Box>
  );
};

export default AIChatWidget; 