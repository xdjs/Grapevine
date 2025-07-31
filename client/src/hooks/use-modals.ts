import { useState, useCallback, useEffect } from 'react';

export interface ModalState {
  // Artist Selection Modal
  showArtistModal: boolean;
  selectedArtistName: string;
  
  // Collaboration Details Popup
  showCollaborationPopup: boolean;
  collaborationArtist: string;
  collaborationCollaborator: string;
  mainArtistName: string;
}

export interface ModalActions {
  // Artist Modal Actions
  openArtistModal: (artistName: string) => void;
  closeArtistModal: () => void;
  
  // Collaboration Popup Actions
  openCollaborationPopup: (data: {
    artist: string;
    collaborator: string;
    mainArtistName: string;
  }) => void;
  closeCollaborationPopup: () => void;
  
  // Artist Selection Handler
  handleArtistSelection: (artistId: string, musicNerdBaseUrl?: string) => void;
  
  // Utility Actions
  closeAllModals: () => void;
  isAnyModalOpen: boolean;
}

export interface UseModalsProps {
  musicNerdBaseUrl?: string;
  onArtistSelection?: (artistId: string) => void;
}

/**
 * Custom hook for managing modal states and interactions
 * Handles artist selection modal and collaboration details popup
 */
export function useModals({ 
  musicNerdBaseUrl, 
  onArtistSelection 
}: UseModalsProps = {}): ModalState & ModalActions {
  // Artist Selection Modal State
  const [showArtistModal, setShowArtistModal] = useState(false);
  const [selectedArtistName, setSelectedArtistName] = useState('');
  
  // Collaboration Details Popup State
  const [showCollaborationPopup, setShowCollaborationPopup] = useState(false);
  const [collaborationArtist, setCollaborationArtist] = useState('');
  const [collaborationCollaborator, setCollaborationCollaborator] = useState('');
  const [mainArtistName, setMainArtistName] = useState('');

  // Artist Modal Actions
  const openArtistModal = useCallback((artistName: string) => {
    setSelectedArtistName(artistName);
    setShowArtistModal(true);
  }, []);

  const closeArtistModal = useCallback(() => {
    setShowArtistModal(false);
    setSelectedArtistName('');
  }, []);

  // Collaboration Popup Actions
  const openCollaborationPopup = useCallback((data: {
    artist: string;
    collaborator: string;
    mainArtistName: string;
  }) => {
    setCollaborationArtist(data.artist);
    setCollaborationCollaborator(data.collaborator);
    setMainArtistName(data.mainArtistName);
    setShowCollaborationPopup(true);
  }, []);

  const closeCollaborationPopup = useCallback(() => {
    setShowCollaborationPopup(false);
    setCollaborationArtist('');
    setCollaborationCollaborator('');
    setMainArtistName('');
  }, []);

  // Artist Selection Handler
  const handleArtistSelection = useCallback((artistId: string, baseUrl?: string) => {
    const urlToUse = baseUrl || musicNerdBaseUrl;
    
    if (!urlToUse) {
      console.error('🔧 [Config] MusicNerd base URL not available');
      return;
    }

    if (!artistId) {
      console.error('🔧 [Modal] Artist ID is required for selection');
      return;
    }

    const musicNerdUrl = `${urlToUse}/artist/${artistId}`;
    console.log(`🎵 Opening selected artist page: ${musicNerdUrl}`);
    
    try {
      const link = document.createElement('a');
      link.href = musicNerdUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Call optional callback
      onArtistSelection?.(artistId);
    } catch (error) {
      console.error('🔧 [Modal] Failed to open artist page:', error);
    }
  }, [musicNerdBaseUrl, onArtistSelection]);

  // Utility Actions
  const closeAllModals = useCallback(() => {
    closeArtistModal();
    closeCollaborationPopup();
  }, [closeArtistModal, closeCollaborationPopup]);

  const isAnyModalOpen = showArtistModal || showCollaborationPopup;

  // Handle ESC key to close modals
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isAnyModalOpen) {
        event.preventDefault();
        closeAllModals();
      }
    };

    if (isAnyModalOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = '';
    };
  }, [isAnyModalOpen, closeAllModals]);

  return {
    // State
    showArtistModal,
    selectedArtistName,
    showCollaborationPopup,
    collaborationArtist,
    collaborationCollaborator,
    mainArtistName,
    
    // Actions
    openArtistModal,
    closeArtistModal,
    openCollaborationPopup,
    closeCollaborationPopup,
    handleArtistSelection,
    closeAllModals,
    isAnyModalOpen,
  };
}